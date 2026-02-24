/**
 * ユーザーグループ更新 Lambda
 * 
 * PUT /users/{userId}/group
 * 管理者専用: ユーザーのグループを変更
 */

import {
  CognitoIdentityProviderClient,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;

const VALID_GROUPS = ['admin', 'internal', 'external'];

interface UpdateGroupRequest {
  group: string;
}

export const handler = async (event: any) => {
  console.log('UpdateUserGroup event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Host',
  };

  try {
    const userId = event.pathParameters?.userId;
    const body: UpdateGroupRequest = JSON.parse(event.body || '{}');

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'ユーザーIDは必須です' }),
      };
    }

    if (!body.group || !VALID_GROUPS.includes(body.group)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          message: '有効なグループを指定してください',
          validGroups: VALID_GROUPS,
        }),
      };
    }

    // 現在のグループを取得
    const listGroupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
    });
    const currentGroups = await client.send(listGroupsCommand);

    // 既存のグループから削除
    for (const group of currentGroups.Groups || []) {
      if (VALID_GROUPS.includes(group.GroupName!)) {
        const removeCommand = new AdminRemoveUserFromGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: userId,
          GroupName: group.GroupName!,
        });
        await client.send(removeCommand);
      }
    }

    // 新しいグループに追加
    const addCommand = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
      GroupName: body.group,
    });
    await client.send(addCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'グループを更新しました',
        userId,
        group: body.group,
      }),
    };
  } catch (error: any) {
    console.error('Error updating user group:', error);

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
        message: 'グループの更新に失敗しました',
        error: error.message,
      }),
    };
  }
};

