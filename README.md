# Shopify Yahoo!広告コンバージョン連携アプリ

Shopifyストアで発生したYahoo!広告のコンバージョンを計測するためのShopifyアプリです。<br>
アプリの形態はカスタムアプリです。<br>
開発は[株式会社キュー](https://web.q-co.jp/)が行なっています。

Shopifyストアのチェックアウトのアップグレードに伴い、<br>
Yahoo!広告のコンバージョンタグを、チェックアウトの追加スクリプトを利用せずに動作させる代替手段が必要になります。<br>
その代替手段の第一候補はWeb Pixelを利用することですが、<br>
2025年8月現在、<br>
Web Pixelでは、Yahoo!広告のコンバージョンタグが期待通り動作しません。

本アプリは、<br>
Yahoo!広告のAPI`OfflineConversionService`を利用し、<br>
ShopifyストアにおけるYahoo!広告のコンバージョンデータをCSVファイルにし、<br>
Yahoo!広告のアカウントにアップロードします。

`OfflineConversionService`について
- https://ads-developers.yahoo.co.jp/reference/ads-search-api/v17/OfflineConversionService/
- https://ads-developers.yahoo.co.jp/reference/ads-display-api/v17/OfflineConversionService/


## 使い方

株式会社キューのテックブログに、使い方を掲載しました。<br>
下記の記事をご参照ください。

https://techlab.q-co.jp/articles/160/


## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

```
MIT License

Copyright (c) 2025 株式会社キュー (Q Co., Ltd.)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 免責事項

このShopifyアプリケーション（以下「本アプリ」）の利用に関して、以下の免責事項が適用されます：

1. **責任の制限**: 本アプリの開発者、提供者、および関連するすべての当事者は、本アプリの使用または使用不能により生じるいかなる直接的、間接的、偶発的、特別、結果的、または懲罰的損害についても責任を負いません。

2. **データの正確性**: 本アプリは「現状のまま」提供され、データの正確性、完全性、または適時性について保証しません。

3. **サービスの中断**: 本アプリの利用可能性、機能性、またはパフォーマンスについて保証しません。サービスが中断される可能性があります。

4. **第三者のサービス**: Yahoo!広告APIやその他の第三者サービスとの連携において、それらのサービスの利用可能性や機能性について保証しません。

5. **商業的利用**: 本アプリの使用による商業的損失、データ損失、またはその他の損失について、開発者は一切の責任を負いません。

本アプリを使用することにより、利用者はこれらの免責事項に同意したものとみなされます。
