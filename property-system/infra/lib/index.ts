#!/usr/bin/env node
/**
 * Property System CDK App Entry Point
 *
 * 使用方法:
 *   npx cdk deploy --context env=dev
 *   npx cdk deploy --context env=prod
 *   npx cdk deploy --context env=dev --context skipFrontend=true
 */

import * as cdk from 'aws-cdk-lib';
import { PropertySystemStack } from './property-system-stack';

// Source map support
try {
  require('source-map-support/register');
} catch {
  // source-map-support not available
}

const app = new cdk.App();

// コンテキストから環境名を取得（デフォルト: dev）
const envName = app.node.tryGetContext('env') || 'dev';
const skipFrontendDeploy = app.node.tryGetContext('skipFrontend') === 'true';

// AWS 環境設定
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1',
};

// バリデーション
const validEnvNames = ['dev', 'staging', 'prod', 'suzuichi01'];
if (!validEnvNames.includes(envName)) {
  throw new Error(`Invalid environment name: ${envName}. Must be one of: ${validEnvNames.join(', ')}`);
}

// メインスタック
new PropertySystemStack(app, `PropertySystemStack-${envName}`, {
  envName,
  skipFrontendDeploy,
  env,
  description: `不動産建築会社向け施工情報管理システム (${envName})`,
  tags: {
    Project: 'PropertySystem',
    Environment: envName,
    ManagedBy: 'CDK',
  },
});

app.synth();
