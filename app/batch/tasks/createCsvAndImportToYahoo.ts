// SPDX-License-Identifier: MIT

import db from "../../db.server";
import { stringify } from 'csv-stringify/sync';
import iconv from 'iconv-lite';
import { formatInTimeZone } from "date-fns-tz";
import { API, type EndpointKey, YCLID_PREFIX } from "../../constants";
import { getYahooAdToken } from "../../utils/get_yahoo_ad_token.server";
import { CSV_FORMAT } from "../../constants";
import { getYahooAdAccounts } from "../../models/YahooAdAccount.server";
import { getYahooAdApplication } from "../../models/YahooAdApplication.server";

/**
 * Yahoo広告アカウントのコンバージョンデータをCSVファイルに変換してYahoo広告APIにアップロードする
 * 
 * この関数は以下の処理を実行します：
 * 1. Yahoo広告アプリケーションの設定を取得
 * 2. アクセストークンを更新（必要に応じて）
 * 3. 各Yahoo広告アカウントに対して：
 *    - 未処理のコンバージョンレコードを取得
 *    - コンバージョンデータをCSV形式に変換
 *    - Yahoo広告APIにCSVファイルをアップロード
 *    - 処理済みフラグを更新
 * 
 * @returns {Promise<void>} 処理完了時に解決されるPromise
 * 
 * @example
 * ```typescript
 * await createCsvAndImportToYahoo();
 * ```
 */
export default async function createCsvAndImportToYahoo() {
  try {
    // Yahoo広告アプリケーションの設定を取得
    const yahooAdApplication = await getYahooAdApplication();
    if(!yahooAdApplication) return;
    
    // 全てのYahoo広告アカウントを取得
    const yahooAdAccounts = await getYahooAdAccounts();
    if(!yahooAdAccounts) return;
        
    // アクセストークンを更新（必要に応じて）
    const accessToken = await getYahooAdToken(yahooAdApplication, true);
    if(!accessToken) return;

    await db.yahooAdApplication.update({
      where: { clientId: yahooAdApplication.clientId },
      data:  { accessToken: accessToken },
    });

    // 各Yahoo広告アカウントに対して処理を実行
    for(const yahooAdAccount of yahooAdAccounts){
      if(!yahooAdAccount.type || !yahooAdAccount.accountId || !yahooAdAccount.childAccountId || !yahooAdAccount.conversionTitle) continue;

      const type = yahooAdAccount.type as EndpointKey;
      const now = new Date();
      // 有効期限を計算（duration日分）
      const expiredAt = new Date(now.getTime() - yahooAdAccount.duration * 24 * 60 * 60 * 1000);
      // 1時間前の時刻を計算
      const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

      // 未処理のコンバージョンレコードを取得
      const records = await db.yahooConversion.findMany({
        where: {
          yclid: {
            startsWith: YCLID_PREFIX[type]
          },
          visitedAt: {
            gte: expiredAt,          
            lt : now
          },
          isProcessed: {
            equals: false
          },
          conversionedAt: {
            gte: oneHourAgo,
            lt : now
          }
        }
      });
      if(!records?.length) {
        console.log(`No records to upload to Yahoo Ads: ${yahooAdAccount.type}`);
        continue;
      }

      const conversionTitle = yahooAdAccount?.conversionTitle;

      // コンバージョンデータをCSV形式に変換
      const rows = type === "search" ? 
      records.map(record => ({
        "YCLID":                  record.yclid,
        "コンバージョン名":          conversionTitle,
        "コンバージョン発生日時":     formatInTimeZone(new Date(record.conversionedAt), 'Asia/Tokyo' , "yyyyMMdd HHmmss"),
        "1コンバージョンあたりの価値": record.amount,
        "通貨コード":               CSV_FORMAT.CURRENCY
      }))
      :
      records.map(record => ({
        "YCLID":                  record.yclid,
        "コンバージョン名":          conversionTitle,
        "コンバージョン発生日時":     formatInTimeZone(new Date(record.conversionedAt), 'Asia/Tokyo' , "yyyyMMdd HHmmss"),
        "1コンバージョンあたりの価値": record.amount
      }));

      // CSVファイルを生成（Shift_JISエンコーディング）
      const csvUtf8 = stringify(rows, { header: true });
      const csv     = iconv.encode(csvUtf8, 'Shift_JIS');
      const csvBlob = new Blob([csv], { type: 'text/csv' });

      // FormDataを作成してCSVファイルを添付
      const formData = new FormData();
      const csvFileName = 
        "shopify_cv_" + type + "_" +
        formatInTimeZone(new Date(), 'Asia/Tokyo' , "yyyyMMdd_HHmmss") +
        ".csv"
      formData.append('file', csvBlob, csvFileName);

      // Yahoo広告APIのリクエストURLとパラメータを構築
      const request_query = new URLSearchParams({
        accountId: yahooAdAccount.childAccountId,
        uploadType: "NEW",
        uploadFileName: csvFileName
      });

      const request_url =
        API.ENDPOINT[type] +
        API.VERSION + 
        API.CSV_UPLOAD_PATH +
        "?" +
        request_query.toString();

      // リクエストヘッダーを設定
      const request_headers = {
        "x-z-base-account-id": yahooAdAccount.accountId,
        "Authorization": "Bearer " + yahooAdApplication.accessToken
      }

      const request_option = {
          method: "POST", 
          headers: request_headers,
          body: formData
      };

      // Yahoo広告APIにCSVファイルをアップロード
      try {
        const res = await fetch(request_url, request_option);

        const isJson = (res.headers.get("content-type") || "").includes("application/json");
        const body = isJson ? await res.json() : await res.text();

        if (!res.ok) {
          console.error(`createCsvAndImportToYahoo error: [${res.status}] ${res.statusText}\n${body}`);
          continue;
        } else {
          if (isJson && body?.errors?.length) {
            body.errors.forEach((err : any ) => {
              console.error(`createCsvAndImportToYahoo error: [${err.code}] ${err.message}`);
              err.details?.forEach((d : any) => {
                console.error(`createCsvAndImportToYahoo error: [${d.requestKey}] ${d.requestValue}`);
              });
            });
          }
        }
      } catch (error) {
        console.error('createCsvAndImportToYahoo error:', error);
        continue;
      }

      // 処理済みフラグを更新
      await db.yahooConversion.updateMany({
        where: { yclid: { in: records.map(r => r.yclid) } },
        data:  { isProcessed: true },
      });
      console.log(`CSV uploaded to Yahoo Ads: ${csvFileName}`);
    }
  } catch (error) {
    console.error('createCsvAndImportToYahoo error:', error);
  }
  return;
}