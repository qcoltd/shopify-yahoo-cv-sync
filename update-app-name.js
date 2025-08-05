// SPDX-License-Identifier: MIT

import crypto from 'crypto';
import fs from 'fs';

// コマンドライン引数を解析する関数
function parseArgs(args) {
  const options = {
    name: null,
    toml: null // nullの場合はデフォルトのshopify.app.tomlを使用
  };

  for (const arg of args) {
    if (arg.startsWith('--name=')) {
      options.name = arg.substring(7); // '--name='の長さは7
    } else if (arg.startsWith('--toml=')) {
      options.toml = arg.substring(7); // '--toml='の長さは7
    }
  }

  return options;
}

// コマンドライン引数を取得
const args = process.argv.slice(2);
const options = parseArgs(args);
let newAppName;
let shopifyTomlPath;

// tomlファイル名を決定
if (options.toml) {
  // --toml=で指定された場合はshopify.app.{指定値}.tomlの形式で生成
  shopifyTomlPath = `shopify.app.${options.toml}.toml`;
} else {
  // 指定されていない場合はデフォルトのshopify.app.tomlを使用
  shopifyTomlPath = 'shopify.app.toml';
}

// prefix
const prefix_app_name = 'shopifyapp-';

if (options.name) {
  // --name=で指定された場合はその値を使用
  newAppName = options.name;
  console.log('指定されたアプリ名:', newAppName);
} else {
  // 指定されていない場合はランダムな英数24文字を生成
  newAppName = prefix_app_name + crypto.randomBytes(12).toString('hex');
  console.log('ランダム生成されたアプリ名:', newAppName);
}

// --toml=で指定されたshopify.app.*.tomlファイルを使用
console.log('使用するshopify.app.tomlファイル:', shopifyTomlPath);

console.log('文字数:', newAppName.length);

// fly.tomlを更新
const flyTomlPath = 'fly.toml';
let flyToml = fs.readFileSync(flyTomlPath, 'utf8');
flyToml = flyToml.replace(/app = '.*?'/, `app = '${newAppName}'`);
// SHOPIFY_APP_URLも更新（SHOPIFY_APP_URL行のみを対象）
flyToml = flyToml.replace(
  /^  SHOPIFY_APP_URL = 'https:\/\/[^']+'/m,
  `  SHOPIFY_APP_URL = 'https://${newAppName}.fly.dev'`
);
fs.writeFileSync(flyTomlPath, flyToml);

// shopify.app.tomlを更新
let shopifyToml = fs.readFileSync(shopifyTomlPath, 'utf8');

// application_urlを更新（application_url行のみを対象）
shopifyToml = shopifyToml.replace(
  /^application_url = "https:\/\/[^"]+"/m,
  `application_url = "https://${newAppName}.fly.dev"`
);

// redirect_urlsセクション内のURLのみを更新
const lines = shopifyToml.split('\n');
let inRedirectUrlsSection = false;
const updatedLines = lines.map(line => {
  // redirect_urlsセクションの開始を検出
  if (line.trim().startsWith('[auth]')) {
    inRedirectUrlsSection = false;
  }
  if (line.trim().startsWith('redirect_urls')) {
    inRedirectUrlsSection = true;
  }
  
  // redirect_urlsセクション内のURLのみを更新
  if (inRedirectUrlsSection && line.includes('https://')) {
    // 現在のURLからドメイン部分を抽出して新しいドメインに置き換え
    return line.replace(/https:\/\/[^\/"]+/g, `https://${newAppName}.fly.dev`);
  }
  return line;
});
shopifyToml = updatedLines.join('\n');

fs.writeFileSync(shopifyTomlPath, shopifyToml);

console.log('fly.tomlとshopify.app.tomlを更新しました');
console.log(`新しいアプリURL: https://${newAppName}.fly.dev`);
console.log('下記のURLをYahoo!広告のアプリケーションのリダイレクトURIに設定してください');
console.log(`https://${newAppName}.fly.dev/receive/code`);