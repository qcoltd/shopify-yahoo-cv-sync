/**
 * GraphQLクライアントの型定義
 * Shopify Admin APIとの通信に使用される
 */
type GraphqlClient = {
  /**
   * GraphQLクエリを実行するメソッド
   * @param query - 実行するGraphQLクエリ文字列
   * @param options - クエリ実行時のオプション（変数など）
   * @returns Promise<any> - GraphQLレスポンス
   */
  graphql: (query: string, options?: any) => Promise<any>;
};

import {GraphqlQueryError} from '@shopify/shopify-api';
import generatePublicKey from "../batch/tasks/generatePublicKey";

/**
 * Web Pixelが接続されていることを確認し、必要に応じてアクティベートする
 * 
 * この関数は以下の処理を行います：
 * 1. 現在のWeb Pixelの存在を確認
 * 2. Web Pixelが存在しない場合、新しいWeb Pixelを作成
 * 3. 公開鍵を生成
 * 
 * @param admin - Shopify Admin APIのGraphQLクライアント
 * @returns Promise<void> - 処理完了時に解決されるPromise
 * 
 * @throws {GraphqlQueryError} GraphQLクエリ実行時にエラーが発生した場合
 */
export async function ensurePixelConnected(admin: GraphqlClient) {
  /**
   * Web Pixelをアクティベートする内部関数
   * 
   * 新しいWeb Pixelを作成し、設定を適用します。
   * 設定にはJWK（JSON Web Key）とAPIホストが含まれます。
   * 
   * @returns Promise<void> - アクティベーション完了時に解決されるPromise
   */
  async function activateWebPixel() : Promise<boolean> {
    const { data } = await admin.graphql(
      `mutation($webPixel: WebPixelInput!) {
        webPixelCreate(webPixel: $webPixel) { userErrors { message } }
      }`,
      {
        variables: { 
          webPixel: { 
            settings: {
              jwk: "dummy",
              api_host: process.env.SHOPIFY_APP_URL || "dummy",
            }
          }
        }
      }
    );
    if (data?.webPixelCreate?.userErrors?.length > 0) return false;

    return true;
  }

  /**
   * Web Pixelの初期化処理を実行する内部関数
   * 
   * activateWebPixelとgeneratePublicKeyの両方を実行し、
   * 失敗した場合は再試行します。
   * 
   * @returns Promise<void> - 初期化処理完了時に解決されるPromise
   */
  async function finalize() {
    if(!await activateWebPixel()) await activateWebPixel();
    if(!await generatePublicKey()) await generatePublicKey();
  }

  const query = `query { webPixel { id } }`;
  try {
    const { data } = await admin.graphql(query).then(r => r.json());
    if (!data?.webPixel?.id) {
      await finalize();
    }
  } catch (error) {
    if(error instanceof GraphqlQueryError && !error.body?.data?.webPixel) {
      await finalize();
    } else {
      console.log("activate_webpixel.server.ts error:", error);
    }
  }
}