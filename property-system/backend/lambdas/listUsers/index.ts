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

const client = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;

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
        lastLogin: cognitoUser.UserLastModifiedDate?.toISOString(),
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

