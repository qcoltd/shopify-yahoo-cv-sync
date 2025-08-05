// SPDX-License-Identifier: MIT

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Shopifyのshop/update webhookを処理するアクション関数
 *
 * このwebhookは、ショップの情報が更新された際に呼び出されます。
 * 主な処理として、ショップのプライマリドメインが変更された場合に
 * セッションテーブルのprimaryDomainフィールドを更新します。
 *
 * @param request - リクエストオブジェクト
 * @returns 空のレスポンス
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Shopify webhookの認証を実行
  const { shop, session, topic, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (session) {
    // 現在のセッション情報をデータベースから取得
    const savedData = await db.session.findFirst({where: { id: session.id }});
    const savedPrimaryDomain = savedData ? savedData.primaryDomain : null;

    try {
      // Shopify GraphQL APIを使用してショップの現在のプライマリドメインを取得
      const { data } = await admin.graphql(`query {shop{ primaryDomain { url } }}`).then(r => r.json());
      if(!data?.shop?.primaryDomain?.url) return new Response();
      const storesPrimaryDomain = data.shop.primaryDomain.url;

      // プライマリドメインが変更されている場合、データベースを更新
      if(storesPrimaryDomain && savedPrimaryDomain !== storesPrimaryDomain){
        await db.session.update({
          where: {id: session.id},
          data: {primaryDomain: storesPrimaryDomain},
        });
        console.log(`Updated primary domain`);
      }
    } catch(error) {
      console.error("shop/update webhook error:", error);
    }
  }
  return new Response();
};
