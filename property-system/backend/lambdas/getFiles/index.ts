import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME || '';

type FileType = 'photo' | 'drawing' | 'pdf' | 'movie' | 'others';

interface FileInfo {
  name: string;
  url: string;
  key: string;
  size?: number;
  lastModified?: string;
}

interface FilesResponse {
  photo: FileInfo[];
  drawing: FileInfo[];
  pdf: FileInfo[];
  movie: FileInfo[];
  others: FileInfo[];
}

const FILE_TYPES: FileType[] = ['photo', 'drawing', 'pdf', 'movie', 'others'];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
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

    const files: FilesResponse = {
      photo: [],
      drawing: [],
      pdf: [],
      movie: [],
      others: [],
    };

    // 各ファイルタイプごとにファイルを取得
    for (const fileType of FILE_TYPES) {
      const prefix = `property/${propertyId}/${fileType}/`;

      const listResult = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
        })
      );

      if (listResult.Contents) {
        const fileInfos: FileInfo[] = [];

        for (const obj of listResult.Contents) {
          if (!obj.Key || obj.Key.endsWith('/')) continue;

          // ファイル名を抽出
          const fileName = obj.Key.split('/').pop() || '';

          // 署名付き URL を生成（有効期限: 1時間）
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: obj.Key,
          });
          const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

          fileInfos.push({
            name: fileName,
            url,
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified?.toISOString(),
          });
        }

        // ファイル名であいうえお順（五十音順）にソート
        fileInfos.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

        files[fileType] = fileInfos;
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        status: 'success',
        data: files,
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






