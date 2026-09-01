/**
 * 操作履歴（監査ログ）の共通モジュール
 *
 * 「誰が・いつ・どの物件を・どう変更したか」を PropertyHistory テーブルに記録する。
 *
 * 設計方針:
 * - 履歴の書き込み失敗は本処理を止めない（try/catch で握り潰してログのみ残す）
 * - テナントごとにテーブルを分ける（Properties-prod → PropertyHistory-prod）
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'crypto';

import { resolveTableName } from './tenantResolver';

const client = new DynamoDBClient({});

// タイムライン用 GSI のパーティションキー（全件を時系列で引くための固定値）
export const TIMELINE_PK = 'ALL';

// ========================================
// 型定義
// ========================================

export type AuditAction =
  | 'create'      // 物件の新規登録
  | 'update'      // 物件の編集
  | 'delete'      // 物件の削除
  | 'bulkCreate'  // CSV 一括登録
  | 'fileUpload'  // ファイル追加
  | 'fileDelete'; // ファイル削除

export interface Actor {
  userId: string;
  userName: string;
  userEmail: string;
}

export interface FieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface HistoryRecordInput {
  /** API Gateway 経由の場合は必須。S3 トリガー経由では tableName + actor を指定する */
  event?: APIGatewayProxyEvent;
  propertyId: string;
  propertyName?: string;
  action: AuditAction;
  changes?: FieldChange[];
  detail?: string;
  /** S3 トリガーなど、ログイン利用者が存在しない経路で使う */
  actor?: Actor;
  /** event を持たない経路（S3 トリガー）ではテーブル名を直接指定する */
  tableName?: string;
}

// ========================================
// 操作者の解決
// ========================================

/**
 * Cognito の JWT クレームからログイン中のユーザーを取り出す。
 * name 属性が未設定のユーザーはメールアドレスを表示名にする。
 */
export function getActor(event: APIGatewayProxyEvent): Actor {
  const claims = (event.requestContext?.authorizer?.claims || {}) as Record<string, string>;

  const userId = claims['sub'] || claims['cognito:username'] || 'unknown';
  const userEmail = claims['email'] || '';
  const userName = claims['name'] || userEmail || '不明なユーザー';

  return { userId, userName, userEmail };
}

/** CSV の S3 自動取込など、利用者を特定できない経路で使う操作者 */
export function systemActor(): Actor {
  return {
    userId: 'system',
    userName: 'システム（自動取込）',
    userEmail: '',
  };
}

// ========================================
// テーブル名の解決
// ========================================

/**
 * 物件テーブル名から履歴テーブル名を導出する。
 *   Properties-prod        → PropertyHistory-prod
 *   Properties-suzuichi01  → PropertyHistory-suzuichi01
 */
export function historyTableFromPropertiesTable(propertiesTable: string): string {
  const PREFIX = 'Properties';
  if (propertiesTable.startsWith(PREFIX)) {
    return `PropertyHistory${propertiesTable.slice(PREFIX.length)}`;
  }
  return process.env.HISTORY_TABLE_NAME || 'PropertyHistory';
}

export function resolveHistoryTableName(event: APIGatewayProxyEvent): string {
  return historyTableFromPropertiesTable(resolveTableName(event));
}

// ========================================
// 変更差分の抽出
// ========================================

/** 画面表示用の項目名 */
export const FIELD_LABELS: Record<string, string> = {
  rbs: 'RBS',
  ownershipType: '物件区分',
  name: '物件名',
  zipcode: '郵便番号',
  prefecture: '都道府県',
  city: '市区町村',
  address: '番地',
  lat: '緯度',
  lng: '経度',
  typeLarge: '大項目',
  typeMedium: '中項目',
  typeSmall: '小項目',
  landUse: '用途地域',
  structure: '構造',
  area: '面積',
  owner: '施主',
  staff: '担当者',
  siteStaff: '現場担当者',
  deliveryDate: '引渡時期',
  memo: '備考',
};

/** 履歴に残す対象項目（updateProperty の更新対象と揃える） */
export const TRACKED_FIELDS = Object.keys(FIELD_LABELS);

function toDisplayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '（空）';
  return String(value);
}

/**
 * 変更前後を比較して、実際に変わった項目だけを返す。
 * 値が同じ項目は履歴に残さない（「更新した」だけの空ログを防ぐため）。
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of TRACKED_FIELDS) {
    // 入力に含まれていない項目は今回の更新対象外なのでスキップ
    if (!(field in after) || after[field] === undefined) continue;

    const beforeValue = toDisplayValue(before[field]);
    const afterValue = toDisplayValue(after[field]);

    if (beforeValue === afterValue) continue;

    changes.push({
      field,
      label: FIELD_LABELS[field] || field,
      before: beforeValue,
      after: afterValue,
    });
  }

  return changes;
}

// ========================================
// 履歴の書き込み
// ========================================

/**
 * 操作履歴を 1 件記録する。
 *
 * 履歴の記録に失敗しても本処理（物件の登録・更新など）は成功させたいので、
 * 例外は投げずにログ出力だけ行う。
 */
export async function recordHistory(input: HistoryRecordInput): Promise<void> {
  try {
    const tableName =
      input.tableName || (input.event ? resolveHistoryTableName(input.event) : '');
    const actor = input.actor || (input.event ? getActor(input.event) : systemActor());

    if (!tableName) {
      console.error('[auditLog] 履歴テーブルを特定できませんでした:', input.propertyId);
      return;
    }
    const timestamp = new Date().toISOString();

    const item = {
      propertyId: input.propertyId,
      // 同一ミリ秒の衝突を避けるため UUID を付与
      eventId: `${timestamp}#${randomUUID().slice(0, 8)}`,
      timestamp,
      userId: actor.userId,
      userName: actor.userName,
      userEmail: actor.userEmail,
      action: input.action,
      propertyName: input.propertyName || '',
      changes: input.changes || [],
      detail: input.detail || '',
      gsiPk: TIMELINE_PK,
    };

    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      })
    );
  } catch (error) {
    // 履歴が残せなくても本処理は続行する
    console.error('[auditLog] 履歴の記録に失敗しました:', error);
  }
}

/**
 * 複数件の履歴をまとめて記録する（CSV 一括登録用）。
 * 件数が多くなるため並列度を抑えて実行する。
 */
export async function recordHistoryBatch(inputs: HistoryRecordInput[]): Promise<void> {
  const CONCURRENCY = 10;

  for (let i = 0; i < inputs.length; i += CONCURRENCY) {
    const chunk = inputs.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map((input) => recordHistory(input)));
  }
}
