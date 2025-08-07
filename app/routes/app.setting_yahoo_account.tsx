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
  TextField,
  BlockStack,
  PageActions,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { YahooAdAccount } from "@prisma/client";
import { getYahooAdAccounts } from "../models/YahooAdAccount.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  return Response.json(await getYahooAdAccounts());
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  /* ---------- 削除 ---------- */
  if (action === "delete") {
    await db.yahooAdAccount.deleteMany();
    return Response.json({ deleted: true });
  }

  /* ---------- 追加・更新 ---------- */
  const ids              = formData.getAll("id");
  const types            = formData.getAll("type");
  const accountIds       = formData.getAll("accountId"); 
  const childAccountIds  = formData.getAll("childAccountId");
  const conversionTitles = formData.getAll("conversionTitle");
  const durations        = formData.getAll("duration");

  if (
    types.length !== accountIds.length ||
    types.length !== childAccountIds.length ||
    types.length !== conversionTitles.length ||
    types.length !== durations.length
  ) {
    throw new Response("行数が揃っていません", { status: 400 });
  }

  /* 配列をオブジェクト配列へ */
  const records = types.map((t, i) => ({
    id:              ids[i] ? Number(ids[i]) : undefined,
    type:            String(t),
    accountId:       String(accountIds[i]),
    childAccountId:  String(childAccountIds[i]),
    conversionTitle: String(conversionTitles[i]),
    duration:        durations[i] ? Number(durations[i]) : undefined,
  }));

  /* トランザクションで upsert */
  await db.$transaction(
    records.map(r =>
      db.yahooAdAccount.upsert({
        where: { id: r.id ?? -1 }, 
        create: {
          id: r.id!,
          type: r.type,
          accountId: r.accountId,
          childAccountId: r.childAccountId,
          conversionTitle: r.conversionTitle,
          duration: r.duration ?? 0,
        },
        update: {
          type: r.type,
          accountId: r.accountId,
          childAccountId: r.childAccountId,
          conversionTitle: r.conversionTitle,
          duration: r.duration ?? 0,
        },
      }),
    ),
  );

  return Response.json({ saved: records.length });
}

export default function SettingYahooAccountPage() {
  type ActionData = {
    errors?: Record<string, string>;
    deleted?: boolean;
  };
  const actionData = useActionData<ActionData>();
  const errors = actionData?.errors || {};

  const blankRows = () => [
    { type: "search",  id: 1, accountId: "", childAccountId: "", conversionTitle: "", duration: undefined },
    { type: "display", id: 2, accountId: "", childAccountId: "", conversionTitle: "", duration: undefined },
  ];

  useEffect(() => {
    if (actionData?.deleted) {
      setFormStates(blankRows());
      setCleanFormStates(blankRows());
    }
  }, [actionData]);

  type FormState = {
    id: number;
    type: string;
    accountId: string;
    childAccountId: string;
    conversionTitle: string;
    duration?: number;
  };

  const yahooAdAccounts = useLoaderData<YahooAdAccount[] | null>();

  // 共通の変換関数
  const convertToFormStates = (accounts: YahooAdAccount[] | null, useBlankRows: boolean = false) => {
    if (useBlankRows || !accounts?.length) {
      return blankRows();
    }
    return accounts.map(yaa => ({
      id: yaa.id,
      type: yaa.type,
      accountId: yaa.accountId,
      childAccountId: yaa.childAccountId,
      conversionTitle: yaa.conversionTitle,
      duration: yaa.duration,
    }));
  };

  const [formStates, setFormStates] = useState<FormState[]>(
    () => convertToFormStates(yahooAdAccounts, false)
  );

  const [cleanFormStates, setCleanFormStates] = useState<FormState[]>(
    () => convertToFormStates(yahooAdAccounts, false)
  );
  const isDirty = JSON.stringify(formStates) !== JSON.stringify(cleanFormStates);

  useEffect(() => {
    setFormStates(convertToFormStates(yahooAdAccounts, false));
    setCleanFormStates(convertToFormStates(yahooAdAccounts, false));
  }, [yahooAdAccounts]);

  const nav = useNavigation();
  const isSaving =
    nav.state === "submitting" && nav.formData?.get("action") !== "delete";
  const isDeleting =
    nav.state === "submitting" && nav.formData?.get("action") === "delete";
  
  const navigate = useNavigate();

  const submit = useSubmit();

  function handleSave() {
    const fd = new FormData();

    formStates.forEach(row => {
      fd.append("type", row.type);
      fd.append("accountId", row.accountId);
      fd.append("childAccountId", row.childAccountId);
      fd.append("conversionTitle", row.conversionTitle);
      row.duration !== undefined ?
      fd.append("duration", String(row.duration)) :
      fd.append("duration", "") ;
      if (row.id !== undefined) fd.append("id", String(row.id));
    });

    setCleanFormStates([...formStates]);
    submit(fd, { method: "post" });
  }

  function handleDelete() {
    // フォームを即座に空にする（UI が一気にリセット）
    setFormStates(blankRows());
    setCleanFormStates(blankRows());

    // DB 削除をサーバに送信
    submit({ action: "delete" }, { method: "post" });
  }

  const hasValidId = (acs: YahooAdAccount[] | null) => !!acs?.length && acs.every(a => !!a.id);

  return (
    <Page>
      <ui-title-bar title="広告アカウント設定">
        <button variant="breadcrumb" onClick={() => navigate("/app")}>
          Home
        </button>
      </ui-title-bar>
      <Layout>
        { formStates?.map((formState, index) => (
          <Layout.Section key={index}>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="500">
                  <Text as={"h2"} variant="headingLg">
                    { index === 0 ? '検索広告' : 'ディスプレイ広告' }
                  </Text>
                  <TextField
                    id={`type-${index}`}
                    helpText="search=検索広告、display=ディスプレイ広告"
                    label="広告タイプ"
                    autoComplete="off"
                    value={index === 0 ? 'search' : 'display'}
                    readOnly
                    error={errors.title}
                  />                  
                  <TextField
                    id={`accountId-${index}`}
                    helpText="Account IDを入力してください"
                    label="Account ID"
                    autoComplete="off"
                    value={formState?.accountId}
                    onChange={(value) =>
                      setFormStates((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, accountId: value } : r,
                        ),
                      )
                    }
                    error={errors.title}
                  />
                  <TextField
                    id={`childAccountId-${index}`}
                    helpText="Child Account IDを入力してください"
                    label="Child Account ID"
                    autoComplete="off"
                    value={formState?.childAccountId}
                    onChange={(value) =>
                      setFormStates((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, childAccountId: value } : r,
                        ),
                      )
                    }
                    error={errors.title}
                  />
                  <TextField
                    id={`conversionTitle-${index}`}
                    helpText="コンバージョン名を入力してください"
                    label="コンバージョン名"
                    autoComplete="off"
                    value={formState?.conversionTitle}
                    onChange={(value) =>
                      setFormStates((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, conversionTitle: value } : r,
                        ),
                      )
                    }
                    error={errors.title}
                  />
                  <TextField
                    id={`duration-${index}`}
                    helpText="コンバージョンの有効期間を入力してください"
                    label="コンバージョンの有効期間"
                    autoComplete="off"
                    value={formState?.duration? String(formState.duration) : ""}
                    onChange={(value) =>
                      setFormStates((prev) =>
                        prev.map((r, i) =>
                          i === index ? { ...r, duration: Number(value) } : r,
                        ),
                      )
                    }
                    error={errors.title}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        ))}

        <Layout.Section>
          <PageActions
            secondaryActions={[
              {
                content: "Delete",
                loading: isDeleting,
                disabled: !hasValidId(yahooAdAccounts) || isSaving || isDeleting,
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
