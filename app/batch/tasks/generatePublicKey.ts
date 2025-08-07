// SPDX-License-Identifier: MIT

import { generateKeyPair, exportJWK, exportPKCS8 } from 'jose';
import db from "../../db.server";
import { apiVersion } from "../../shopify.server";
import { createAdminApiClient } from "@shopify/admin-api-client";
import crypto from "node:crypto";

/**
 * 新しいRSA鍵ペアを生成し、Web Pixelの設定を更新する
 * 
 * この関数は以下の処理を実行します：
 * 1. RSA-OAEP-256アルゴリズムで2048ビットの鍵ペアを生成
 * 2. 公開鍵をJWK形式でエクスポートし、データベースに保存
 * 3. 古い鍵ペアを削除（最大3つまで保持）
 * 4. Shopify Web Pixelの設定を更新して新しいJWKを設定
 * 
 * @returns {Promise<boolean>} 処理が成功した場合はtrue、失敗した場合はfalse
 * @throws {Error} Web Pixelが存在しない場合、またはPixel更新に失敗した場合
 * 
 * @example
 * ```typescript
 * try {
 *   const success = await generatePublicKey();
 *   if (success) {
 *     console.log('鍵ペアの生成とPixel更新が完了しました');
 *   }
 * } catch (error) {
 *   console.error('鍵ペア生成に失敗しました:', error);
 * }
 * ```
 */
export default async function generatePublicKey(): Promise<boolean> {
  // RSA-OAEP-256アルゴリズムで2048ビットの鍵ペアを生成
  const { publicKey, privateKey } = await generateKeyPair(
    'RSA-OAEP-256',
    {
      modulusLength: 2048,
      extractable: true,
    }
  );

  // 一意のキーIDを生成
  const kid = crypto.randomUUID();
  
  // 公開鍵をJWK形式でエクスポートし、キーIDを設定
  const jwk_row = await exportJWK(publicKey);
  jwk_row.kid = kid;
  const jwk = JSON.stringify(jwk_row);

  // データベースに保存する鍵ペア情報を構築
  const apiKeyPair = {
    kid:        kid,
    publicKey:  jwk,
    privateKey: await exportPKCS8(privateKey),
    createdAt:  new Date()
  }

  try {
    // 新しい鍵ペアをデータベースに保存
    await db.apiKeyPair.create({data: apiKeyPair});

    // 最新の鍵ペアを取得（作成日時順）
    const apiKeyPairs = await db.apiKeyPair.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 3
    });

    // 最新の3つ以外の鍵ペアを削除
    await db.apiKeyPair.deleteMany({
      where: {
        kid: { notIn: apiKeyPairs.map(akp => akp.kid) }
      }
    });

    // セッション情報を取得
    const session = await db.session.findFirst();

    // Shopify Admin APIクライアントを作成
    const admin = createAdminApiClient({
      storeDomain: session!.shop,
      apiVersion,
      accessToken: session!.accessToken,
    });

    // Web PixelのIDを取得
    const pixelRes = await admin.request(`#graphql
      { webPixel { id } }
    `);
    const pixelId = pixelRes?.data?.webPixel?.id;
    if (!pixelId) throw new Error("Web Pixel not found");

    // Web Pixelの設定を更新して新しいJWKを設定
    const pixelUpdateRes = await admin.request(`#graphql
      mutation ($id: ID!, $webPixel: WebPixelInput!) {
        webPixelUpdate(id: $id, webPixel: $webPixel) {
          userErrors { field message }
          webPixel   { id settings }
        }
      }
    `, {
      variables: {
        id: pixelId,
        webPixel: {
          settings: { "jwk": jwk, "api_host": process.env.SHOPIFY_APP_URL }
        }
      },
    });

    // エラーが発生した場合は鍵ペアを削除してエラーを投げる
    if (pixelUpdateRes?.data?.webPixelUpdate?.userErrors?.length) {
      console.error(pixelUpdateRes.data.webPixelUpdate.userErrors);
      await db.apiKeyPair.delete({ where: { kid: kid } });
      throw new Error("Failed to update Web Pixel");
    }

    console.log("Web Pixel updated successfully");
  } catch(error) {
    console.error("generatePublicKey error:", error);
    return false;
  }
  return true;
}
