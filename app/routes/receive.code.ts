// SPDX-License-Identifier: MIT

/**
 * Yahoo!広告APIのOAuth認証コード受信エンドポイント
 * 
 * このルートは、Yahoo!広告APIのOAuth認証フローで使用されます。
 * ユーザーがYahoo!の認証ページで認証を完了した後、このエンドポイントにリダイレクトされ、
 * 認証コードを受け取ってアクセストークンを取得します。
 * 
 * @fileoverview Yahoo!広告API OAuth認証コード受信処理
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { getYahooAdApplication } from "../models/YahooAdApplication.server";
import { getYahooAdToken } from "../utils/get_yahoo_ad_token.server";

/**
 * エラーレスポンスを生成するヘルパー関数
 * 
 * @param code - エラーコード番号
 * @returns エラーレスポンスオブジェクト
 */
const errorResponse = (code: number) => Response.json(
  { error: "不正なアクセスです。error_code:" + code },
  { status: 405 }
);

/**
 * Yahoo!広告APIのOAuth認証コードを受信し、アクセストークンを取得するローダー関数
 * 
 * この関数は以下の処理を行います：
 * 1. GETリクエストのみを許可
 * 2. URLパラメータからstateとcodeを取得
 * 3. Yahoo!広告アプリケーション情報を取得
 * 4. stateパラメータの検証
 * 5. 認証コードを使用してアクセストークンを取得
 * 6. 成功時は完了ページのHTMLを返す
 * 
 * @param request - Remixのリクエストオブジェクト
 * @returns 成功時はHTMLレスポンス、エラー時はJSONエラーレスポンス
 * 
 * @throws {Error} データベース操作やトークン取得時のエラー
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
 
  try {
    if (request.method !== "GET") return errorResponse(1);

    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if(!state || !code) return errorResponse(2);

    const yahooAdApplication = await getYahooAdApplication();
    if(!yahooAdApplication) return errorResponse(3);

    if(state !== yahooAdApplication.state) return errorResponse(4);

    const updatedYahooAdApplication = await db.yahooAdApplication.update({
      where: { clientId: yahooAdApplication.clientId },
      data:  { code: code }
    });
    if(!updatedYahooAdApplication) return errorResponse(5);

    const accessToken = await getYahooAdToken(updatedYahooAdApplication);
    if(!accessToken) return errorResponse(6);

    const html = `<!DOCTYPE html>
      <html lang="ja">
        <head>
          <meta charset="utf-8" />
          <title>Yahoo! OAuth 完了</title>
        </head>
        <body>
          <h1>連携完了</h1>
          <p>このページは閉じていただいて大丈夫です。</p>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("error:", error);
    return Response.json(
      { error: "error" },
      { status: 500 }
    );
  }
}; 