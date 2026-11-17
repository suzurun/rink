import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DeleteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

import { unmarshall } from '@aws-sdk/util-dynamodb';

import { resolveTableName } from '../shared/tenantResolver';
import { recordHistory } from '../shared/auditLog';

const dynamoClient = new DynamoDBClient({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const TABLE_NAME = resolveTableName(event);
    console.log('Resolved TABLE_NAME:', TABLE_NAME);

    // 認可チェック（admin のみ許可）
    const groups = event.requestContext.authorizer?.claims?.['cognito:groups'] || '';
    if (!groups.includes('admin')) {
      return {
        statusCode: 403,
        headers: corsHeaders(),
        body: JSON.stringify({ status: 'error', message: '削除権限がありません（管理者のみ）' }),
      };
    }

    const propertyId = event.pathParameters?.propertyId;

    if (!propertyId) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ status: 'error', message: 'propertyId is required' }),
      };
    }

    // 存在チェック
    const existingItem = await dynamoClient.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          propertyId: { S: propertyId },
        },
      })
    );

    if (!existingItem.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ status: 'error', message: '物件が見つかりません' }),
      };
    }

    const beforeData = unmarshall(existingItem.Item);

    // S3 のファイルは削除しない（添付は残す。物件に紐づかなくなるだけ）

    // DynamoDB から削除
    await dynamoClient.send(
      new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: {
          propertyId: { S: propertyId },
        },
      })
    );

    // 操作履歴を記録（物件本体が消えても履歴は残る）
    await recordHistory({
      event,
      propertyId,
      propertyName: (beforeData.name ?? '') as string,
      action: 'delete',
    });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        status: 'success',
        message: '物件を削除しました',
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ status: 'error', message: 'Internal Server Error' }),
    };
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Host',
  };
}






