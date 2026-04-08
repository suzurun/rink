import { APIGatewayProxyEvent } from 'aws-lambda';

const TENANT_TABLE_MAP: Record<string, string> = {
  'rink.myvalue.jp': 'Properties-prod',
};

const DEFAULT_TABLE = process.env.TABLE_NAME || 'Properties';

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * リクエストヘッダーからテナントのホスト名を解決する。
 * 優先順位:
 *   1. X-Forwarded-Host  (CloudFront / ALB が付与)
 *   2. Host              (API Gateway が受け取るリクエストホスト)
 *   3. Origin            (ブラウザが付与 — POST/PUT 等)
 *   4. Referer           (ブラウザが付与 — GET 含む)
 *
 * 各ステップで TENANT_TABLE_MAP に一致するかを確認し、
 * 一致したらその時点で確定する。
 */
function extractTenantHost(event: APIGatewayProxyEvent): string {
  const h = event.headers || {};

  // 1) X-Forwarded-Host
  const xfh = h['X-Forwarded-Host'] || h['x-forwarded-host'] || '';
  if (xfh) {
    const val = xfh.split(',')[0].trim();
    if (TENANT_TABLE_MAP[val]) return val;
  }

  // 2) Host
  const host = h['Host'] || h['host'] || '';
  if (host) {
    const val = host.split(':')[0].trim();
    if (TENANT_TABLE_MAP[val]) return val;
  }

  // 3) Origin (https://suzuichi01.myvalue.jp → suzuichi01.myvalue.jp)
  const origin = h['Origin'] || h['origin'] || '';
  if (origin) {
    const val = hostnameFromUrl(origin);
    if (val && TENANT_TABLE_MAP[val]) return val;
  }

  // 4) Referer (https://suzuichi01.myvalue.jp/properties → suzuichi01.myvalue.jp)
  const referer = h['Referer'] || h['referer'] || '';
  if (referer) {
    const val = hostnameFromUrl(referer);
    if (val && TENANT_TABLE_MAP[val]) return val;
  }

  // どれにも一致しなかった場合、最初に取れた値を返す（ログ用）
  return xfh.split(',')[0].trim()
    || host.split(':')[0].trim()
    || hostnameFromUrl(origin)
    || hostnameFromUrl(referer)
    || '(empty)';
}

export function resolveTableName(event: APIGatewayProxyEvent): string {
  const host = extractTenantHost(event);
  const selectedTable = TENANT_TABLE_MAP[host] || DEFAULT_TABLE;

  console.log('[tenantResolver]', JSON.stringify({
    'X-Forwarded-Host': event.headers?.['X-Forwarded-Host'] || event.headers?.['x-forwarded-host'] || '',
    Host: event.headers?.['Host'] || event.headers?.['host'] || '',
    Origin: event.headers?.['Origin'] || event.headers?.['origin'] || '',
    Referer: event.headers?.['Referer'] || event.headers?.['referer'] || '',
    resolvedHost: host,
    selectedTable,
  }));

  return selectedTable;
}

export function resolveBucketName(event: APIGatewayProxyEvent): string {
  const host = extractTenantHost(event);

  const TENANT_BUCKET_MAP: Record<string, string> = {
    'rink.myvalue.jp': process.env.BUCKET_NAME || '',
  };

  if (TENANT_BUCKET_MAP[host]) {
    return TENANT_BUCKET_MAP[host];
  }

  return process.env.BUCKET_NAME || '';
}



