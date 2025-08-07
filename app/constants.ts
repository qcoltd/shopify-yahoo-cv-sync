// SPDX-License-Identifier: MIT

/**
 * Yahoo Ads OAuth認証に関する定数
 */
export const AUTH = {
  /** APIバージョン */
  VERSION: "v1",
  /** OAuth認証エンドポイント */
  ENDPOINT: "https://biz-oauth.yahoo.co.jp/oauth/",
  /** 認可エンドポイントパス */
  AUTHORIZE_PATH: "/authorize",
  /** トークン取得エンドポイントパス */
  TOKEN_PATH: "/token",
  /** レスポンスタイプ */
  RESPONSE_TYPE: "code",
  /** スコープ */
  SCOPE: "yahooads",
  /** 認可コードグラントタイプ */
  GRANT_TYPE: "authorization_code",
  /** リフレッシュトークングラントタイプ */
  REFRESH_GRANT_TYPE: "refresh_token",
  /** リダイレクトURI */
  REDIRECT_URI: "/receive/code"
} as const;

/**
 * Yahoo Ads APIに関する定数
 */
export const API = {
  /** APIバージョン */
  VERSION: "v17",
  /** APIエンドポイント */
  ENDPOINT: {
    /** 検索広告APIエンドポイント */
    search : "https://ads-search.yahooapis.jp/api/",
    /** ディスプレイ広告APIエンドポイント */
    display: "https://ads-display.yahooapis.jp/api/",
  } as const,
  /** CSVアップロードパス */
  CSV_UPLOAD_PATH: "/OfflineConversionService/upload",
} as const;

/**
 * APIエンドポイントのキー型
 */
export type EndpointKey = keyof typeof API.ENDPOINT;

/**
 * YCLIDプレフィックス定数
 * YCLIDはYahoo広告のクリックIDを表す
 */
export const YCLID_PREFIX = {
  /** 検索広告のYCLIDプレフィックス */
  search: "YSS",
  /** ディスプレイ広告のYCLIDプレフィックス */
  display: "YJAD"
} as const

/**
 * CSVフォーマットに関する定数
 */
export const CSV_FORMAT = {
  /** 通貨コード */
  CURRENCY: "JPY",
} as const
