// SPDX-License-Identifier: MIT

import { register } from "@shopify/web-pixels-extension";
import { importJWK, CompactEncrypt } from 'jose';

/**
 * Yahoo広告のコンバージョン追跡用Webピクセル拡張機能
 *
 * この拡張機能は以下の機能を提供します：
 * - チェックアウト完了時にコンバージョンデータを暗号化してAPIに送信
 * - Proof of Work（PoW）によるAPI保護
 */
register(({ analytics, browser, settings }) => {

  /**
   * チェックアウト完了イベントのリスナー
   * 保存されたyclidを使用してコンバージョンデータを暗号化し、APIに送信する
   */
  analytics.subscribe('checkout_completed', async (event) => {
    /** Proof of Workの難易度（先頭のゼロビット数） */
    const DIFFICULTY = 10;

    /**
     * ブラウザのクッキーから最新のYahoo広告クリックID（yclid）を取得する
     * 
     * この関数は以下の処理を行います：
     * - ブラウザのクッキーを取得
     * - Yahoo広告関連のクッキー（_ycl_*_aw、_ycl_yjad）を解析
     * - 複数のyclidが見つかった場合、タイムスタンプが最新のものを返す
     * 
     * 対応するクッキー形式：
     * - _ycl_{数字}_aw: GCL.{timestamp}.{value} 形式
     * - _ycl_yjad: YJAD.{timestamp}.{value} 形式
     * 
     * @returns Promise<{ yclid: string, ts: string } | null> - 最新のyclidとタイムスタンプ文字列、見つからない場合はnull
     * 
     * @example
     * ```typescript
     * const latestYclid = await getLatestYclid();
     * if (latestYclid) {
     *   console.log(`YCLID: ${latestYclid.yclid}, Timestamp: ${latestYclid.ts}`);
     * }
     * ```
     */
    async function getLatestYclid(): Promise<{ yclid: string, ts: string } | null> {
      const pool: { yclid: string, ts: number }[] = [];
      const cookies = await browser.cookie.get();
      cookies.split(';').forEach(async (pair) => {
        const [rawName, rawVal] = pair.trim().split('=');
        if (!rawVal) return;
        const name = rawName;
        const value = decodeURIComponent(rawVal);
        const seg = value.split('.');
        if (/^_ycl_\d+_aw$/.test(name) && seg[0] === 'GCL' && seg.length === 3) {
          const numPart = name.match(/^_ycl_(\d+)_aw$/)?.[1];
          if (!numPart) return;
          pool.push({ yclid: `YSS.${numPart}.${seg[2]}`, ts: Number(seg[1]) });
          return;
        }
        if (name === '_ycl_yjad' && seg[0] === 'YJAD' && seg.length === 3) {
          pool.push({ yclid: value, ts: Number(seg[1]) });
        }
      });
      if (!pool.length) return null;
      pool.sort((a, b) => b.ts - a.ts);
      const latestYclid = {
        yclid: pool[0].yclid,
        ts: new Date(pool[0].ts * 1000).toString()
      }
      return latestYclid;
    }

    /**
     * SHA-256ハッシュを計算する
     *
     * @param buf - ハッシュ化するデータ
     * @returns SHA-256ハッシュ値
     */
    async function sha256(buf : Uint8Array<ArrayBufferLike>) {
      const digest = await crypto.subtle.digest('SHA-256', buf);
      return new Uint8Array(digest);
    }

    /**
     * Proof of Work（PoW）を生成する
     * 指定された難易度を満たすハッシュ値を見つけるまで計算を繰り返す
     * WebPixelからAppProxyを利用できないため苦肉の策
     * より良い方法があれば、そちらに変更すること
     *
     * @returns Base64エンコードされたPoW文字列
     */
    async function makePow() {
      const unixMin = Math.floor(Date.now() / 60000);
      const rand16  = crypto.getRandomValues(new Uint16Array(8)).join('');
      const seedStr = `${unixMin}:${rand16}:`;
      const enc     = new TextEncoder();

      let counter = 0;
      while (true) {
        const data = enc.encode(seedStr + counter);
        const hash = await sha256(data);
        let zeros = 0;
        for (const byte of hash) {
          const z = Math.clz32(byte) - 24;
          zeros += z;
          if (z !== 8) break;
        }
        if (zeros >= DIFFICULTY) {
          return btoa(seedStr + counter);
        }
        counter++;
      }
    }

    const savedYclid = await getLatestYclid();
    if (!savedYclid) return;

    const apiHost = settings.api_host;
    const apiPath = "/api/setConversion"

    const API_ENDPOINT = apiHost + apiPath;

    /**
     * APIにコンバージョンデータを送信する（リトライ機能付き）
     * 
     * この関数は、コンバージョンデータを暗号化してAPIエンドポイントに送信します。
     * 送信に失敗した場合、最大3回までリトライを実行します。
     * 各リトライ間には500msの待機時間を設けています。
     * 
     * @param retryCount - 現在のリトライ回数（デフォルト: 0）
     * @returns Promise<boolean> - 送信が成功した場合はtrue、最大リトライ回数に達して失敗した場合はfalse
     * 
     * @example
     * ```typescript
     * const success = await sendConversionData();
     * if (!success) {
     *   console.error('API送信が最大リトライ回数に達しました');
     * }
     * ```
     */
    async function sendConversionData(retryCount = 0): Promise<boolean> {
      const MAX_RETRIES = 3;
      
      /** APIに送信するコンバージョンデータ */
      const payload = {
        yclid: savedYclid?.yclid,
        visitedAt: savedYclid?.ts || null,
        conversionedAt: new Date(event.timestamp).toString(),
        amount: event.data.checkout.totalPrice?.amount,
        orderId: event.data.checkout.order!.id,
        nonce: crypto.randomUUID()
      }

      // コンバージョンデータを暗号化
      const jwk = JSON.parse(settings.jwk);
      const key = await importJWK(jwk, 'RSA-OAEP-256');
      const jwe = await new CompactEncrypt(
        new TextEncoder().encode(JSON.stringify(payload))
      )
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: jwk.kid })
      .encrypt(key);

      // Proof of Workを生成
      const pow = await makePow();
      
      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {'X-POW': pow, 'Content-Type': 'application/jose' },
          body: jwe,
          keepalive: true,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return true;
      } catch(error) {
        console.error(`API送信エラー (試行 ${retryCount + 1}/${MAX_RETRIES}):`, error);        
        if (retryCount < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
          return sendConversionData(retryCount + 1);
        }
        return false;
      }
    }

    try {
      const success = await sendConversionData();
      if (!success) {
        console.error('API送信が最大リトライ回数に達しました');
      }
    } catch(error) {
      console.error('予期しないエラー:', error);
    }
  });
});
