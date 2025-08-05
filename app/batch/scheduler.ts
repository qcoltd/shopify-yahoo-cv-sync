// SPDX-License-Identifier: MIT

/**
 * バッチタスクスケジューラー
 * 
 * このモジュールは、定期的に実行されるバッチタスクを管理します。
 * node-cronを使用してスケジュールされたタスクを実行し、
 * 重複実行を防ぐためにグローバルフラグを使用します。
 * 
 * @module scheduler
 */

import cron from "node-cron";
import createCsvAndImportToYahoo from "./tasks/createCsvAndImportToYahoo";
import deleteExpiredRecords from "./tasks/deleteExpiredRecords";
import generatePublicKey from "./tasks/generatePublicKey";
import cleanUpPixelNonce from "./tasks/cleanUpPixelNonce";
import prisma from "../../app/db.server";

/**
 * グローバル変数の型定義
 * スケジューラーの重複起動を防ぐためのフラグ
 */
declare global {
  var __CRON_STARTED__: boolean | undefined;
}

/**
 * スケジューラーの初期化とタスクの登録
 * 
 * グローバルフラグを使用して重複実行を防ぎ、
 * 以下のタスクをスケジュールします：
 * - 公開鍵生成（10分間隔）
 * - CSV作成とYahoo広告へのインポート（20分間隔）
 * - 期限切れレコードの削除とピクセルノンスのクリーンアップ（毎日4:00 JST）
 */
if (!global.__CRON_STARTED__) {
  global.__CRON_STARTED__ = true;

  /**
   * 公開鍵生成タスク
   * 10分間隔で実行され、セキュリティキーの更新を行います
   */
  cron.schedule("*/10 * * * *", async () => {
    try {
      await generatePublicKey();
    } catch (e) {
      console.error("generatePublicKey error", e);
    }
  });

  /**
   * CSV作成とYahoo広告へのインポートタスク
   * 20分間隔で実行され、コンバージョンデータをYahoo広告に送信します
   */
  cron.schedule("*/20 * * * *", async () => {
    try {
      await createCsvAndImportToYahoo();
    } catch (e) {
      console.error("createCsvAndImportToYahoo error", e);
    }
  });

  /**
   * メンテナンスタスク
   * 毎日4:00 JSTに実行され、以下の処理を行います：
   * - 期限切れレコードの削除
   * - ピクセルノンスのクリーンアップ
   */
  cron.schedule("00 4 * * *", async () => {
    await deleteExpiredRecords();
    await cleanUpPixelNonce();
  }, {
    timezone: "Asia/Tokyo",
  });

  /**
   * プロセス終了時のクリーンアップ処理
   * データベース接続を適切に切断します
   */
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });

  console.log("[cron] jobs scheduled");
}