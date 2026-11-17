/**
 * ログイン日時の記録 Lambda（Cognito PostAuthentication トリガー）
 *
 * Cognito にはログイン日時を保持する項目が無い（UserLastModifiedDate は
 * アカウント情報を変更した日であって、ログインしても更新されない）。
 * そのため、サインイン成功のたびにこの Lambda が呼ばれて DynamoDB に記録する。
 *
 * 重要: このトリガーが例外を投げるとユーザーがログインできなくなる。
 * 記録に失敗してもログインは必ず成功させるため、例外は握りつぶしてログだけ残す。
 *
 * 注意: リフレッシュトークンによるセッション更新では発火しない（実際に
 * ID とパスワードでサインインしたときだけ記録される）。
 */

import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});

const LOGIN_TABLE_NAME = process.env.LOGIN_TABLE_NAME || '';

export const handler = async (event: any): Promise<any> => {
  try {
    const userId = event?.userName;
    const email = event?.request?.userAttributes?.email || '';

    if (!LOGIN_TABLE_NAME) {
      console.error('LOGIN_TABLE_NAME is not set; skipping login record');
      return event;
    }

    if (!userId) {
      console.error('No userName in event; skipping login record', JSON.stringify(event));
      return event;
    }

    const now = new Date().toISOString();

    await client.send(
      new UpdateItemCommand({
        TableName: LOGIN_TABLE_NAME,
        Key: marshall({ userId }),
        // lastLogin は毎回上書き、loginCount は加算していく
        UpdateExpression:
          'SET lastLogin = :now, email = :email, updatedAt = :now ADD loginCount :one',
        ExpressionAttributeValues: marshall({
          ':now': now,
          ':email': email,
          ':one': 1,
        }),
      })
    );

    console.log('Recorded login:', userId, now);
  } catch (error) {
    // ログイン自体は成功させる
    console.error('Failed to record login (login itself is not affected):', error);
  }

  return event;
};
