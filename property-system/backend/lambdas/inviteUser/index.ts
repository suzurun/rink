/**
 * ユーザー招待 Lambda
 * 
 * POST /users/invite
 * 管理者専用: 新規ユーザーを作成し招待メールを送信
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;

interface InviteRequest {
  email: string;
  group?: string;
  name?: string;
}

export const handler = async (event: any) => {
  console.log('InviteUser event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Host',
  };

  try {
    const body: InviteRequest = JSON.parse(event.body || '{}');

    if (!body.email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'メールアドレスは必須です' }),
      };
    }

    // メールアドレスのバリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: '有効なメールアドレスを入力してください' }),
      };
    }

    // ユーザーを作成
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: body.email,
      UserAttributes: [
        { Name: 'email', Value: body.email },
        { Name: 'email_verified', Value: 'true' },
        ...(body.name ? [{ Name: 'name', Value: body.name }] : []),
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    });

    const createResult = await client.send(createUserCommand);

    // グループに追加（指定がある場合）
    const group = body.group || 'external';
    try {
      const addToGroupCommand = new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: body.email,
        GroupName: group,
      });
      await client.send(addToGroupCommand);
    } catch (groupError) {
      console.error('Error adding user to group:', groupError);
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: `${body.email} に招待メールを送信しました`,
        userId: createResult.User?.Username,
      }),
    };
  } catch (error: any) {
    console.error('Error inviting user:', error);

    if (error.name === 'UsernameExistsException') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ message: 'このメールアドレスは既に登録されています' }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'ユーザーの招待に失敗しました',
        error: error.message,
      }),
    };
  }
};

