import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

import { resolveTableName } from '../shared/tenantResolver';

const client = new DynamoDBClient({});

interface PropertyInput {
  propertyId: string;
  name: string;
  zipcode: string;
  prefecture: string;
  city: string;
  address: string;
  lat?: number;
  lng?: number;
  typeLarge: string;
  typeMedium?: string;
  typeSmall?: string;
  landUse?: string;
  structure?: string;
  area?: number;
  owner?: string;
  staff?: string;
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

    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ status: 'error', message: 'Request body is required' }),
      };
    }

    const input: PropertyInput = JSON.parse(event.body);

    // バリデーション
    const validationError = validateInput(input);
    if (validationError) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ status: 'error', message: validationError }),
      };
    }

    // 重複チェック
    const existingItem = await client.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          propertyId: { S: input.propertyId },
        },
      })
    );

    if (existingItem.Item) {
      return {
        statusCode: 409,
        headers: corsHeaders(),
        body: JSON.stringify({ status: 'error', message: 'propertyId already exists' }),
      };
    }

    const now = new Date().toISOString();
    const item = {
      ...input,
      files: {
        photo: [],
        drawing: [],
        pdf: [],
        movie: [],
        others: [],
      },
      createdAt: now,
      updatedAt: now,
    };

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(item, { removeUndefinedValues: true }),
      })
    );

    return {
      statusCode: 201,
      headers: corsHeaders(),
      body: JSON.stringify({
        status: 'success',
        data: item,
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

function validateInput(input: PropertyInput): string | null {
  if (!input.propertyId) return 'propertyId is required';
  if (!input.name) return 'name is required';
  if (!input.zipcode) return 'zipcode is required';
  if (!input.prefecture) return 'prefecture is required';
  if (!input.city) return 'city is required';
  if (!input.address) return 'address is required';
  if (!input.typeLarge) return 'typeLarge is required';
  return null;
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Host',
  };
}






