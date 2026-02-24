/**
 * ユーザー削除 Lambda
 * 
 * DELETE /users/{userId}
 * 管理者専用: ユーザーを削除
 */

import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;

export const handler = async (event: any) => {
  console.log('DeleteUser event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Host',
  };

  try {
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'ユーザーIDは必須です' }),
      };
    }

    // ユーザーを削除
    const deleteCommand = new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
    });
    await client.send(deleteCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'ユーザーを削除しました',
        userId,
      }),
    };
  } catch (error: any) {
    console.error('Error deleting user:', error);

    if (error.name === 'UserNotFoundException') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'ユーザーが見つかりません' }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'ユーザーの削除に失敗しました',
        error: error.message,
      }),
    };
  }
};

