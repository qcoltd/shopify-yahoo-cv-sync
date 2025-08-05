// SPDX-License-Identifier: MIT

import db from "../../db.server";

/**
 * 90日を経過したYahooコンバージョンデータを削除する関数
 * 
 * この関数は、visitedAtが90日前より古いYahooコンバージョンレコードを
 * データベースから削除します。データの古いレコードを定期的にクリーンアップし、
 * データベースの容量を管理するために使用されます。
 * 
 * @returns {Promise<void>} 削除処理の完了を表すPromise
 * 
 * @example
 * ```typescript
 * // 定期的なクリーンアップタスクとして実行
 * await deleteExpiredRecords();
 * ```
 * 
 * @throws {Error} データベース操作中にエラーが発生した場合
 * エラーはコンソールにログ出力され、関数は正常に終了します
 */
export default async function deleteExpiredRecords(): Promise<void> {
  const now = new Date();
  const expiredAt = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  try {
    const deletedRecords = await db.yahooConversion.deleteMany({
      where: {
        visitedAt: {
          lt : expiredAt
        }
      }
    });
    if(deletedRecords?.count) {
      console.log("Deleted expired yahoo cv records");
    } else {
      console.log("There was nothing to delete expired yahoo cv records");
    }
  } catch(error) {
    console.error("deleteExpiredRecords error:", error);
  }
  return;
}