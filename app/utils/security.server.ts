import { randomBytes } from "node:crypto";

/**
 * Yahoo Ads API 用の state パラメータを生成します。
 * 
 * OAuth 2.0 認証フローで使用される state パラメータは、CSRF攻撃を防ぐために
 * ランダムな値である必要があります。この関数は暗号学的に安全な乱数を生成し、
 * URL セーフな base64url エンコーディングで返します。
 * 
 * @param byteLength - 生成する乱数のバイト長。デフォルトは32バイト（256ビット）
 * @returns URL セーフな base64url エンコードされた文字列（約43文字）
 * 
 * @example
 * ```typescript
 * const state = createYahooAdState(); // 32バイトのランダムなstate
 * const customState = createYahooAdState(16); // 16バイトのランダムなstate
 * ```
 * 
 * @see {@link https://tools.ietf.org/html/rfc4648#section-5 | RFC 4648 - Base64URL}
 */
export function createYahooAdState(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}
