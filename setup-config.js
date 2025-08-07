// SPDX-License-Identifier: MIT

import fs from 'fs';
import path from 'path';

// .envファイルからSHOPIFY_API_KEYを読み取る
function getShopifyApiKeyFromEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const apiKeyMatch = envContent.match(/SHOPIFY_API_KEY=([^\r\n]+)/);
  
  return apiKeyMatch[1].trim();
}

// fly.tomlのSHOPIFY_API_KEYを更新する
function updateFlyTomlApiKey(apiKey) {
  const flyTomlPath = path.join(process.cwd(), 'fly.toml');
  let flyTomlContent = fs.readFileSync(flyTomlPath, 'utf8');
  
  // SHOPIFY_API_KEYの値を更新
  flyTomlContent = flyTomlContent.replace(
    /SHOPIFY_API_KEY = '[^']*'/,
    `SHOPIFY_API_KEY = '${apiKey}'`
  );
  
  fs.writeFileSync(flyTomlPath, flyTomlContent);
  console.log('fly.tomlのSHOPIFY_API_KEYを更新しました');
}

// 現在のshopify.app.tomlからclient_idとorganization_idを取得
function getCurrentCredentials() {
  const currentConfig = fs.readFileSync('shopify.app.toml', 'utf8');
  const clientIdMatch = currentConfig.match(/client_id = "([^"]+)"/);
  const organizationIdMatch = currentConfig.match(/organization_id = "([^"]+)"/);
  
  return {
    client_id: clientIdMatch ? clientIdMatch[1] : '',
    organization_id: organizationIdMatch ? organizationIdMatch[1] : ''
  };
}

// テンプレートファイルを読み込み、認証情報を置き換える
function applyTemplateWithCredentials() {
  const credentials = getCurrentCredentials();
  let template = fs.readFileSync('shopify.app.toml.template', 'utf8');
  
  // client_idとorganization_idを現在の値に置き換え
  template = template.replace(/client_id = "[^"]*"/, `client_id = "${credentials.client_id}"`);
  template = template.replace(/organization_id = "[^"]*"/, `organization_id = "${credentials.organization_id}"`);
  
  // 新しい設定をshopify.app.tomlに書き込み
  fs.writeFileSync('shopify.app.toml', template);
  
  console.log('テンプレート設定を適用しました（client_idとorganization_idは保持）');
}

// update-app-name.jsを実行
async function runUpdateAppName() {
  console.log('update-app-name.jsを実行中...');
  const { execSync } = await import('child_process');
  execSync('node update-app-name.js', { stdio: 'inherit' });
}

// メイン処理
async function main() {
  try {
    console.log('設定をセットアップ中...');
    
    // SHOPIFY_API_KEYを.envから読み取り、fly.tomlを更新
    const apiKey = getShopifyApiKeyFromEnv();
    updateFlyTomlApiKey(apiKey);
    
    applyTemplateWithCredentials();
    await runUpdateAppName();
    console.log('設定のセットアップが完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main(); 