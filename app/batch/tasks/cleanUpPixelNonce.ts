// SPDX-License-Identifier: MIT

import db from "../../db.server";

/**
 * 1日以上経過したpixel nonceレコードをデータベースから削除する
 * 
 * この関数は、セキュリティ上の理由で古いnonceレコードを定期的にクリーンアップするために使用されます。
 * nonceは一度使用されると無効になるため、1日以上経過したレコードは不要です。
 * 
 * @returns Promise<void> - 処理完了時に解決されるPromise
 * 
 * @example
 * ```typescript
 * // バッチ処理で実行
 * await cleanUpPixelNonce();
 * ```
 */
export default async function cleanUpPixelNonce() {
  const now = new Date();
  const expiredAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  try {
    const deletedRecords = await db.pixelNonce.deleteMany({
      where: {
        receivedAt: {
          lt : expiredAt
        }
      }
    });
    if(deletedRecords?.count) {
      console.log("Cleared old Web Pixel nounces");
    } else {
      console.log("There was nothing to clear old Web Pixel nounces");
    }
  } catch(error) {
    console.error("cleanUpPixelNonce error:", error);
  }

  return;
}