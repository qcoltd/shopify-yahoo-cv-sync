// SPDX-License-Identifier: MIT

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { apiVersion } from "../../shopify.server";
import { createAdminApiClient } from "@shopify/admin-api-client";
import db from "../../db.server";
import { Prisma } from "@prisma/client";
import { importPKCS8, compactDecrypt, decodeProtectedHeader } from 'jose';
import crypto from "node:crypto";
import { setTimeout as sleep } from 'node:timers/promises';

/** Proof of Workの難易度（先頭のゼロビット数） */
const POW_BITS      = 10;
/** Proof of Workの有効期限（ミリ秒） */
const POW_VALID_MS  = 2 * 60_000;

/**
 * Proof of Work（PoW）の検証を行う
 * @param b64 - Base64エンコードされたPoWデータ
 * @returns PoWが有効な場合はtrue、そうでなければfalse
 */
function checkPow(b64: string | null): boolean {
  if (!b64) return false;
  const data = Buffer.from(b64, "base64").toString("utf8");
  const [unixMinStr] = data.split(":");
  const minTime = parseInt(unixMinStr, 10) * 60_000;
  if (Number.isNaN(minTime) || Math.abs(Date.now() - minTime) > POW_VALID_MS) return false;

  const hash = crypto.createHash("sha256").update(data).digest();
  let zeros = 0;
  for (const byte of hash) {
    const z = Math.clz32(byte) - 24;
    zeros += z;
    if (z !== 8) break;
  }
  return zeros >= POW_BITS;
}

/**
 * セッション情報のキャッシュインターフェース
 */
interface SessionCache {
  /** ショップのドメイン */
  shop: string;
  /** アクセストークン */
  accessToken: string;
  /** プライマリドメイン */
  primaryDomain: string | null;
}

/** CORSヘッダーのキャッシュ有効期限（ミリ秒） */
const ALLOW_SESSION_TTL_MS = 5 * 60_000; // 5 min

/** セッション情報のメモリキャッシュ */
let sessionCache: { session: SessionCache, expires: number }  | null = null;

/**
 * データベースからセッション情報を取得し、メモリにキャッシュする
 * @returns セッション情報、またはnull（セッションが存在しない場合）
 */
async function getSession() {
  const now = Date.now();
  if (sessionCache && sessionCache.expires > now) return sessionCache.session;
  const record = await db.session.findFirst();
  if (!record) return null;
  sessionCache = { session: record, expires: now + ALLOW_SESSION_TTL_MS };
  return sessionCache.session;
}

/** プライベートキーのメモリキャッシュ */
let privateKeyCache: Record<string, CryptoKey> = Object.create(null); 

/**
 * 指定されたキーIDに対応するプライベートキーを取得する
 * @param kid - キーID
 * @returns プライベートキー、またはnull（キーが存在しない場合）
 */
async function getPrivateKey(kid: string) {
  // 既にメモリにあればそれを返す
  const hit = privateKeyCache[kid];
  if (hit) return hit;

  // 無ければ DB から取得してキャッシュ
  const record = await db.apiKeyPair.findUnique({
    where: { kid },
    select: { privateKey: true },
  });
  if (!record) return null;
  // キャッシュが無限に増えるのを防ぐため、キャッシュをクリア
  privateKeyCache = Object.create(null);
  const key = await importPKCS8(record.privateKey, "RSA-OAEP-256");
  privateKeyCache[kid] = key;
  return key;
}

/** CORSヘッダーのキャッシュ有効期限（ミリ秒） */
const ALLOW_ORIGIN_TTL_MS = 5 * 60_000; // 5 min
/** CORSヘッダーのキャッシュ */
let allowOriginCache: { value: string; expires: number } | null = null;

/**
 * 許可されたオリジンを取得する
 * @returns 許可されたオリジンのURL
 */
async function getAllowOrigin() {
  const now = Date.now();
  if (allowOriginCache && allowOriginCache.expires > now) {
    return allowOriginCache.value;
  }
  const record = await db.session.findFirst({
    select: { primaryDomain: true, shop: true },
  });
  const value = record ? record.primaryDomain ?? `https://${record.shop}` : "";
  allowOriginCache = { value, expires: now + ALLOW_ORIGIN_TTL_MS };
  return value;
}

/**
 * CORSヘッダーを構築する
 * @returns CORSヘッダーを含むHeadersオブジェクト
 */
async function buildCorsHeaders() {
  const origin = await getAllowOrigin();
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Pow",
    "Content-Type": "application/json",
  });
}

/**
 * エラーレスポンスを生成する
 * @param code - エラーコード
 * @param headers - レスポンスヘッダー
 * @returns エラーレスポンス
 */
const errorResponse = (code: number, headers: Headers) => new Response(
  JSON.stringify({ error: "不正なアクセスです", error_code: code }),
  { status: 405, headers: headers }
);

/**
 * GETリクエストのハンドラー
 * OPTIONSリクエストの場合はCORSプリフライトレスポンスを返す
 * その他のGETリクエストはエラーを返す
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const headers = await buildCorsHeaders();
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  return errorResponse(0, headers);
};

/**
 * POSTリクエストのハンドラー
 * Yahoo広告のコンバージョンデータを受け取り、データベースに保存する
 * 
 * 処理フロー:
 * 1. Proof of Workの検証
 * 2. リクエストボディの復号化
 * 3. ペイロードの検証
 * 4. 重複チェック（nonce、orderId）
 * 5. Shopify APIでの注文存在確認
 * 6. コンバージョンデータの保存
 * 
 * @param request - リクエストオブジェクト
 * @returns 処理結果のレスポンス
 */
export const action = async ({ request }: ActionFunctionArgs) => { 
  const headers = await buildCorsHeaders();
  try {

    if (request.method !== "POST") return errorResponse(1, headers);
    if (!checkPow(request.headers.get("x-pow"))) return errorResponse(2, headers);

    const body = await request.text();
    if (!body) return errorResponse(3, headers);

    const { kid, alg } = decodeProtectedHeader(body);
    if (alg !== 'RSA-OAEP-256') return errorResponse(4, headers);


    const [session, key] = await Promise.all([
      getSession(),
      getPrivateKey(kid as string),
    ]);
    if (!session) return errorResponse(5, headers);
    if (!key) return errorResponse(6, headers);

    const { plaintext } = await compactDecrypt(body, key);
    const payload = JSON.parse(Buffer.from(plaintext).toString('utf8'));
    const { yclid, visitedAt, conversionedAt, amount, orderId, nonce } = payload;
    if (
      typeof yclid !== "string" || 
      typeof visitedAt !== "string" ||
      typeof conversionedAt !== "string"||
      typeof amount !== "number" ||
      typeof orderId !== "string" ||
      typeof nonce !== "string") {
      return errorResponse(7, headers);
    }

    const [_, existing] = await db.$transaction([
      db.pixelNonce.create({ data: { nonce } }),
      db.yahooConversion.findFirst({ where: { orderId } }),
    ]).catch((error) => {
      if (error.code === "P2002") return [null, true];
      throw error;
    });
    if (existing) return errorResponse(8, headers);

    const admin = createAdminApiClient({
      storeDomain: session.shop,
      apiVersion,
      accessToken: session.accessToken,
    });

    const orderGid = `gid://shopify/Order/${orderId}`;
    const query = `#graphql 
      query { order(id: "${orderGid}") { createdAt } }`;
    try {
      await sleep(1000);
      let gqlRes = await admin.request(query);
      if(!gqlRes.data?.order) {
        const gqlRes = await admin.request(query);
        if (!gqlRes.data?.order) {
          console.error("api.setConversion/route.ts error:", JSON.stringify(gqlRes));
          return errorResponse(9, headers);
        }
      }
      if((new Date().getTime() - new Date(String(gqlRes.data.order.createdAt)).getTime()) > 2 * 60_000) return errorResponse(10, headers)
    } catch(error) {
      console.error("api.setConversion/route.ts error:", error);
      return errorResponse(11, headers)
    }

    const data : Prisma.YahooConversionCreateInput = {
      yclid: yclid,
      amount: amount,
      visitedAt: new Date(visitedAt),
      conversionedAt: new Date(conversionedAt),
      orderId: orderId
    }

    try {
      await db.yahooConversion.create({ data })
    } catch(error: any) {
      return errorResponse(12, headers)
    }

    return new Response(
      JSON.stringify({ result: "success"}),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: headers }
    );
  }
}; 