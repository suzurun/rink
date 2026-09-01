import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { resolveTableName } from '../shared/tenantResolver';
import { getActor, recordHistory, diffFields } from '../shared/auditLog';

const client = new DynamoDBClient({});

interface PropertyUpdateInput {
  rbs?: string;
  ownershipType?: string;
  name?: string;
  zipcode?: string;
  prefecture?: string;
  city?: string;
  address?: string;
  lat?: number;
  lng?: number;
  typeLarge?: string;
  typeMedium?: string;
  typeSmall?: string;
  landUse?: string;
  structure?: string;
  area?: number;
  owner?: string;
  staff?: string;
  siteStaff?: string;
  deliveryDate?: string;
  memo?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const TABLE_NAME = resolveTableName(event);
    console.log('Resolved TABLE_NAME:', TABLE_NAME);

    // 認可チェック（external ユーザーは拒否）
    const groups = event.requestContext.authorizer?.claims?.['cognito:groups'] || '';
    if (groups.includes('external')) {
      return {
        statusCode: 403,
        headers: corsHeaders(),
        body: JSON.stringify({ status: 'error', message: 'アクセス権限がありません' }),
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

    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ status: 'error', message: 'Request body is required' }),
      };
    }

    // 存在チェック
    const existingItem = await client.send(
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

    const input: PropertyUpdateInput = JSON.parse(event.body);
    const now = new Date().toISOString();
    const actor = getActor(event);
    const beforeData = unmarshall(existingItem.Item);

    // 変更前後の差分を抽出（履歴用）
    const changes = diffFields(beforeData, input as Record<string, unknown>);

    // 更新式を動的に構築（更新者情報も併せて保存）
    const updateExpressions: string[] = [
      '#updatedAt = :updatedAt',
      '#updatedBy = :updatedBy',
      '#updatedByUserId = :updatedByUserId',
      '#updatedByEmail = :updatedByEmail',
    ];
    const expressionAttributeNames: Record<string, string> = {
      '#updatedAt': 'updatedAt',
      '#updatedBy': 'updatedBy',
      '#updatedByUserId': 'updatedByUserId',
      '#updatedByEmail': 'updatedByEmail',
    };
    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': { S: now },
      ':updatedBy': { S: actor.userName },
      ':updatedByUserId': { S: actor.userId },
      ':updatedByEmail': { S: actor.userEmail },
    };

    const fields = [
      'rbs',
      'ownershipType',
      'name',
      'zipcode',
      'prefecture',
      'city',
      'address',
      'lat',
      'lng',
      'typeLarge',
      'typeMedium',
      'typeSmall',
      'landUse',
      'structure',
      'area',
      'owner',
      'staff',
      'siteStaff',
      'deliveryDate',
      'memo',
    ];

    for (const field of fields) {
      const value = (input as any)[field];
      if (value !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;

        if (typeof value === 'number') {
          expressionAttributeValues[`:${field}`] = { N: value.toString() };
        } else {
          expressionAttributeValues[`:${field}`] = { S: value };
        }
      }
    }

    await client.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: {
          propertyId: { S: propertyId },
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    // 操作履歴を記録（実際に値が変わった場合のみ）
    if (changes.length > 0) {
      await recordHistory({
        event,
        propertyId,
        propertyName: (input.name ?? beforeData.name ?? '') as string,
        action: 'update',
        changes,
        actor,
      });
    }

    // 更新後のデータを取得
    const updatedItem = await client.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          propertyId: { S: propertyId },
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        status: 'success',
        data: unmarshall(updatedItem.Item!),
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






