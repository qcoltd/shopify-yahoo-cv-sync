// SPDX-License-Identifier: MIT

import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  Layout,
  Page,
  Text,
  BlockStack,
} from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  return null;
};

export default function Index() {
  const navigate = useNavigate();

  return (
    <Page>
      <ui-title-bar title="Yahoo!広告コンバージョン連携">
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <Card padding="800">
            <BlockStack gap="500">
              <Text as="h2" variant="headingLg">
                設定方法
              </Text>
              <Text as="p">
                下記のマニュアルに従って、Yahoo!広告コンバージョン連携を設定してください。<br />
                <a href="https://techlab.q-co.jp/articles/160/" target="_blank">https://techlab.q-co.jp/articles/160/</a>
              </Text>
              <BlockStack gap="200">
                <Link to="/app/setting_yahoo_app">Yahoo!広告アプリケーションの設定</Link>                
                <Link to="/app/setting_yahoo_account">Yahoo!広告アカウントの設定</Link>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>    
  );
}
