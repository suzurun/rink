/**
 * ユーザー一覧取得 Lambda
 * 
 * GET /users
 * 管理者専用: Cognitoユーザープールからユーザー一覧を取得
 */

import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, BatchGetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new CognitoIdentityProviderClient({});
const dynamo = new DynamoDBClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;
const LOGIN_TABLE_NAME = process.env.LOGIN_TABLE_NAME || '';

/**
 * ログイン日時をまとめて取得する。
 *
 * Cognito はログイン日時を持たないため、PostAuthentication トリガー
 * （recordLogin Lambda）が別テーブルに記録している。仕組みを入れる前の
 * ログインは記録が無いので、その場合は undefined のままにする。
 */
async function fetchLastLogins(userIds: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  if (!LOGIN_TABLE_NAME || userIds.length === 0) return result;

  // BatchGetItem は 1 回あたり 100 件まで
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);

    try {
      const response = await dynamo.send(
        new BatchGetItemCommand({
          RequestItems: {
            [LOGIN_TABLE_NAME]: {
              Keys: chunk.map((userId) => marshall({ userId })),
            },
          },
        })
      );

      for (const item of response.Responses?.[LOGIN_TABLE_NAME] || []) {
        const record = unmarshall(item) as { userId: string; lastLogin?: string };
        if (record.lastLogin) result[record.userId] = record.lastLogin;
      }
    } catch (err) {
      // ログイン日時が取れなくてもユーザー一覧は返す
      console.error('Error fetching last logins:', err);
    }
  }

  return result;
}

interface User {
  userId: string;
  email: string;
  name?: string;
  groups: string[];
  status: string;
  createdAt?: string;
  lastLogin?: string;
}

export const handler = async (event: any) => {
  console.log('ListUsers event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Host',
  };

  try {
    // ユーザー一覧を取得
    const listUsersCommand = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60,
    });

    const usersResult = await client.send(listUsersCommand);

    // ログイン日時をまとめて引く
    const lastLogins = await fetchLastLogins(
      (usersResult.Users || []).map((u: { Username?: string }) => u.Username!).filter(Boolean)
    );

    const users: User[] = [];

    for (const cognitoUser of usersResult.Users || []) {
      const email = cognitoUser.Attributes?.find(a => a.Name === 'email')?.Value || '';
      const name = cognitoUser.Attributes?.find(a => a.Name === 'name')?.Value;
      
      // ユーザーのグループを取得
      let groups: string[] = [];
      try {
        const groupsCommand = new AdminListGroupsForUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: cognitoUser.Username!,
        });
        const groupsResult = await client.send(groupsCommand);
        groups = groupsResult.Groups?.map(g => g.GroupName!) || [];
      } catch (err) {
        console.error('Error getting groups for user:', cognitoUser.Username, err);
      }

      users.push({
        userId: cognitoUser.Username!,
        email,
        name,
        groups,
        status: cognitoUser.UserStatus || 'UNKNOWN',
        createdAt: cognitoUser.UserCreateDate?.toISOString(),
        // UserLastModifiedDate はアカウント情報の変更日でログイン日ではないため使わない
        lastLogin: lastLogins[cognitoUser.Username!],
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        users,
        total: users.length,
      }),
    };
  } catch (error: any) {
    console.error('Error listing users:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'ユーザー一覧の取得に失敗しました',
        error: error.message,
      }),
    };
  }
};

