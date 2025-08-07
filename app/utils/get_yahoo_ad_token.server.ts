import { AUTH } from "app/constants";
import db from "../db.server";
import { YahooAdApplication } from "@prisma/client";

/**
 * Yahoo広告APIのアクセストークンを取得または更新する
 * 
 * この関数は、Yahoo広告アプリケーションの認証情報を使用して、
 * 新しいアクセストークンを取得するか、既存のリフレッシュトークンを使用して
 * アクセストークンを更新します。
 * 
 * @param yahooAdApplication - Yahoo広告アプリケーションの設定情報
 * @param isRefresh - リフレッシュトークンを使用してトークンを更新するかどうか。デフォルトはfalse
 * 
 * @returns アクセストークンの文字列。エラーが発生した場合は空文字列を返す
 * 
 * @example
 * ```typescript
 * // 新しいアクセストークンを取得
 * const token = await getYahooAdToken(yahooApp);
 * 
 * // リフレッシュトークンを使用してトークンを更新
 * const newToken = await getYahooAdToken(yahooApp, true);
 * ```
 * 
 * @throws ネットワークエラーやAPIエラーが発生した場合、空文字列を返す
 */
export async function getYahooAdToken(yahooAdApplication: YahooAdApplication, isRefresh = false): Promise<string> {
  if(isRefresh && !yahooAdApplication.refreshToken) return "";
  
  const request_query = isRefresh ? 
    new URLSearchParams({
      grant_type   : AUTH.REFRESH_GRANT_TYPE,
      client_id    : yahooAdApplication.clientId,
      client_secret: yahooAdApplication.clientSecret,
      refresh_token: yahooAdApplication.refreshToken!,
    })
    :
    new URLSearchParams({
      grant_type   : AUTH.GRANT_TYPE,
      client_id    : yahooAdApplication.clientId,
      client_secret: yahooAdApplication.clientSecret,
      redirect_uri : yahooAdApplication.redirectUri,
      code         : yahooAdApplication.code!,
    });

   try { 
    const res = await fetch(
      AUTH.ENDPOINT + AUTH.VERSION + AUTH.TOKEN_PATH + '?' + request_query.toString(), {
        method: "GET"
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json")
        ? await res.json()
        : await res.text();

      console.error(
        `Yahoo token request failed (${res.status} ${res.statusText})`,
        body
      );
      return "";
    }

    interface responsePayload {
      access_token : string;
      refresh_token: string;
      expires_in   : number;
      token_type   : "Bearer";
    }
    const response: responsePayload = await res.json();

    const data  = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenCreatedAt: new Date()
    };
    await db.yahooAdApplication.update({
      where: { clientId: yahooAdApplication.clientId },
      data
    })

    return response.access_token;
  } catch(error) {
    return "";
  }
}