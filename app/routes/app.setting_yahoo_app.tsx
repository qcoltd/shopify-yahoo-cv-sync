// SPDX-License-Identifier: MIT

import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useNavigate,
} from "@remix-run/react";
import {
  Card,
  Layout,
  Page,
  Text,
  Button,
  TextField,
  BlockStack,
  PageActions,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Prisma, YahooAdApplication } from "@prisma/client";
import { createYahooAdState } from "../utils/security.server";
import { getYahooAdApplication } from "../models/YahooAdApplication.server";
import { AUTH } from "../constants"

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  return Response.json(await getYahooAdApplication());
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);

  const formData     = await request.formData();
  const action       = formData.get('action');
  const clientId     = formData.get("clientId");
  const clientSecret = formData.get("clientSecret");
  const state        = createYahooAdState();

  const existing = await getYahooAdApplication();

  if (action === "delete" && existing) {
    await db.yahooAdApplication.delete({ where: { clientId: existing.clientId } });
    return Response.json({ deleted: true });
  }

  if (typeof clientId !== "string" || typeof clientSecret !== "string") {
    throw new Response("clientId / clientSecret が不正です", { status: 400 });
  }

  const data : Prisma.YahooAdApplicationCreateInput = {
    clientId,
    clientSecret,
    redirectUri: process.env.SHOPIFY_APP_URL + AUTH.REDIRECT_URI,
    state
  };

  if (existing) {
    await db.yahooAdApplication.update({ where: { clientId: existing.clientId }, data });
  } else {
    await db.yahooAdApplication.create({ data })
  }

  return null;
}

export default function SettingYahooAppPage() {
  type ActionData = {
    errors?: Record<string, string>;
    deleted?: boolean;
  };
  const actionData = useActionData<ActionData>();
  const errors = actionData?.errors || {};

  // フォーム状態の初期化をヘルパー関数で統一
  const createFormState = (app: any): FormState => ({
    clientId: app?.clientId ?? "",
    clientSecret: app?.clientSecret ?? "",
  });

  useEffect(() => {
    if (actionData?.deleted) {
      const blank = createFormState(null);
      setFormState(blank);
      setCleanFormState(blank);
    }
  }, [actionData]);

  type FormState = {
    clientId: string;
    clientSecret: string;
  };

  const yahooAdApplication = useLoaderData<YahooAdApplication | null>();
  
  const [formState, setFormState] = useState<FormState>(createFormState(yahooAdApplication));
  const [cleanFormState, setCleanFormState] = useState<FormState>(createFormState(yahooAdApplication));
  const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState);

  useEffect(() => {
    const newFormState = createFormState(yahooAdApplication);
    setFormState(newFormState);
    setCleanFormState(newFormState);
  }, [yahooAdApplication]);

  const nav = useNavigation();
  const isSaving =
    nav.state === "submitting" && nav.formData?.get("action") !== "delete";
  const isDeleting =
    nav.state === "submitting" && nav.formData?.get("action") === "delete";
  
  const navigate = useNavigate();

  const submit = useSubmit();
  function handleSave() {
    const data = {
      clientId: formState.clientId || "",
      clientSecret: formState.clientSecret || "",
    }

    setCleanFormState({ ...formState });
    submit(data, { method: "post" });
  }

  let auth_url = "#";
  if(yahooAdApplication) {
    const auth_url_query = {
      response_type: AUTH.RESPONSE_TYPE,
      client_id: yahooAdApplication.clientId,
      redirect_uri: yahooAdApplication.redirectUri,
      scope: AUTH.SCOPE,
      state: String(yahooAdApplication.state)
    }
    auth_url = AUTH.ENDPOINT + AUTH.VERSION + AUTH.AUTHORIZE_PATH + '?' + new URLSearchParams(auth_url_query).toString();
  }

  function handleDelete() {
    // フォームを即座に空にする（UI が一気にリセット）
    const blank = createFormState(null);
    setFormState(blank);
    setCleanFormState(blank);

    // DB 削除をサーバに送信
    submit({ action: "delete" }, { method: "post" });
  }

  return (
    <Page>
      <ui-title-bar title="Yahoo!広告アプリケーションの設定">
        <button variant="breadcrumb" onClick={() => navigate("/app")}>
          Home
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="500">
                <Text as={"h2"} variant="headingLg">
                  clientId
                </Text>
                <TextField
                  id="clientId"
                  helpText="Cliend IDを入力してください"
                  label="Client ID"
                  labelHidden
                  autoComplete="off"
                  value={formState?.clientId}
                  onChange={(clientId) => setFormState({ ...formState, clientId })}
                  error={errors.title}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="500">
                <Text as={"h2"} variant="headingLg">
                  clientSecret
                </Text>
                <TextField
                  id="clientSecret"
                  helpText="Client Secretを入力してください"
                  label="Client Secret"
                  labelHidden
                  autoComplete="off"
                  value={formState?.clientSecret}
                  onChange={(clientSecret) => setFormState({ ...formState, clientSecret })}
                  error={errors.title}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {yahooAdApplication?.clientId && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  Yahoo!広告アプリケーションの認可エンドポイント
                </Text>
                <Text variant="bodyMd" as="p">
                  <a href={auth_url} target="_blank">{auth_url}</a>
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {yahooAdApplication?.refreshToken && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  アプリケーション連携完了
                </Text>
                <Text variant="bodyMd" as="p">
                  次に広告アカウントの設定をお願いします。
                </Text>
                <Box>
                  <Button variant="primary" size="micro" url="/app/setting_yahoo_account">広告アカウント設定</Button>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <PageActions
            secondaryActions={[
              {
                content: "Delete",
                loading: isDeleting,
                disabled: !yahooAdApplication?.clientId || !yahooAdApplication || isSaving || isDeleting,
                destructive: true,
                outline: true,
                onAction: handleDelete,
              },
            ]}
            primaryAction={{
              content: "Save",
              loading: isSaving,
              disabled: !isDirty || isSaving || isDeleting,
              onAction: handleSave,
            }}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
