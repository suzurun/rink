/**
 * G08: 一括登録画面（PC限定）
 *
 * 画面仕様:
 * - CSVファイルをアップロード
 * - テンプレートダウンロード機能
 * - アップロード進捗表示
 * - 登録結果（成功/失敗件数）表示
 * - エラーCSVダウンロード
 *
 * 認可: internal / admin
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getIdToken } from '../api/auth';
import { getPropertiesForExport } from '../api/properties';

// API ベース URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// CSVテンプレートのヘッダー
const CSV_HEADERS = [
  'propertyId',
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
  'deliveryDate',
  'memo',
];

// 日本語ヘッダー
const CSV_HEADERS_JP = [
  '物件ID',
  '物件名',
  '郵便番号',
  '都道府県',
  '市区町村',
  '番地',
  '緯度',
  '経度',
  '大項目',
  '中項目',
  '小項目',
  '用途地域',
  '構造',
  '面積',
  '施主',
  '担当者',
  '引渡時期',
  '備考',
];

// アップロード結果の型
interface UploadResult {
  successCount: number;
  errorCount: number;
  errors?: Array<{
    row: number;
    propertyId?: string;
    message: string;
  }>;
  errorFileUrl?: string;
}

// アップロード状態
type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export default function BulkUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [previewData, setPreviewData] = useState<string[][] | null>(null);
  const [exporting, setExporting] = useState(false);

  // モバイル検出
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ========================================
  // ファイル選択
  // ========================================
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // CSVファイルのみ許可
    if (!file.name.endsWith('.csv')) {
      setError('CSVファイルを選択してください');
      return;
    }

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      setError('ファイルサイズは5MB以下にしてください');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);
    setUploadStatus('idle');

    // プレビュー用にCSVを読み込み
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());
      const rows = lines.slice(0, 6).map((line) => parseCSVLine(line)); // 最初の6行のみ
      setPreviewData(rows);
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  // ========================================
  // CSVパース（簡易版）
  // ========================================
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  // ========================================
  // アップロード処理
  // ========================================
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(0);
    setError(null);
    setResult(null);

    try {
      const token = getIdToken();

      // CSVファイルの内容を読み取ってJSON形式で送信
      const csvContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
        reader.readAsText(selectedFile, 'UTF-8');
      });

      // アップロード進捗シミュレーション
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      setUploadStatus('processing');

      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

      const response = await fetch(`${API_BASE_URL}/properties/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Host': hostname,
        },
        body: JSON.stringify({ csv: csvContent }),
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '登録に失敗しました');
      }

      setResult({
        successCount: data.successCount || 0,
        errorCount: data.errorCount || 0,
        errors: data.errors,
        errorFileUrl: data.errorFileUrl,
      });

      setUploadStatus(data.errorCount > 0 ? 'error' : 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました');
      setUploadStatus('error');
    }
  };

  // ========================================
  // テンプレートダウンロード
  // ========================================
  const handleDownloadTemplate = () => {
    // BOM付きUTF-8でCSVを生成
    const bom = '\uFEFF';
    const headerRow = CSV_HEADERS_JP.join(',');
    const sampleRow = [
      'P0001',
      '大谷ビル',
      '8100004',
      '福岡県',
      '福岡市中央区',
      '薬院1-1-1',
      '33.583000',
      '130.394000',
      '工場',
      '製造',
      '食品',
      '第一種住居地域',
      '木造',
      '200',
      '山田太郎',
      '佐藤',
      '20231201',
      'メモ',
    ].join(',');

    const csvContent = bom + headerRow + '\n' + sampleRow + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'property_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ========================================
  // CSV エクスポート（現在の物件データを出力）
  // ========================================
  const handleExportCSV = async () => {
    setExporting(true);
    setError(null);

    try {
      const response = await getPropertiesForExport();

      if (response.status !== 'success' || !response.data.length) {
        setError('エクスポートする物件データがありません');
        setExporting(false);
        return;
      }

      const bom = '\uFEFF';
      const headerRow = CSV_HEADERS_JP.join(',');

      const dataRows = response.data.map((p: Record<string, any>) => {
        const values = CSV_HEADERS.map((key) => {
          const val = p[key];
          if (val == null) return '';
          return String(val);
        });
        return values.map(escapeCSVField).join(',');
      });

      const csvContent = bom + headerRow + '\n' + dataRows.join('\n') + '\n';
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const link = document.createElement('a');
      link.href = url;
      link.download = `properties_export_${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エクスポートに失敗しました');
    } finally {
      setExporting(false);
    }
  };

  // ========================================
  // エラーファイルダウンロード
  // ========================================
  const handleDownloadErrorFile = () => {
    if (result?.errorFileUrl) {
      window.open(result.errorFileUrl, '_blank');
    }
  };

  // ========================================
  // リセット
  // ========================================
  const handleReset = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setResult(null);
    setError(null);
    setPreviewData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ========================================
  // CSV値エスケープ
  // ========================================
  function escapeCSVField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // ========================================
  // モバイル警告
  // ========================================
  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
            <DesktopIcon className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">PC専用画面です</h2>
          <p className="text-slate-600 mb-6">
            一括登録はPCからのみ可能です。
            <br />
            PCでアクセスしてください。
          </p>
          <button
            onClick={() => {
              window.location.href = '/properties';
            }}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            物件一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  window.location.href = '/properties';
                }}
                className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              >
                <BackIcon className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-slate-800">物件一括登録</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 手順説明 */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <InfoIcon className="w-5 h-5 text-blue-600" />
            一括登録の手順
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StepCard
              number={1}
              title="テンプレートをダウンロード"
              description="CSVテンプレートをダウンロードし、物件データを入力してください"
            />
            <StepCard
              number={2}
              title="CSVファイルをアップロード"
              description="入力済みのCSVファイルをドラッグ＆ドロップまたは選択"
            />
            <StepCard
              number={3}
              title="登録結果を確認"
              description="成功件数・エラー件数を確認し、エラーがあれば修正"
            />
          </div>

          {/* テンプレートダウンロード & データ出力 */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                CSVテンプレートをダウンロード
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    エクスポート中...
                  </>
                ) : (
                  <>
                    <ExportIcon className="w-4 h-4 mr-2" />
                    現在の物件データをCSV出力
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              ※ CSVファイルはUTF-8形式で保存してください
            </p>
          </div>
        </section>

        {/* ファイルアップロード */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <UploadIcon className="w-5 h-5 text-blue-600" />
            CSVファイルをアップロード
          </h2>

          {/* ドロップゾーン */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file && fileInputRef.current) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInputRef.current.files = dataTransfer.files;
                handleFileSelect({ target: fileInputRef.current } as any);
              }
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              selectedFile
                ? 'border-blue-300 bg-blue-50'
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div>
                <FileIcon className="w-12 h-12 mx-auto text-blue-500 mb-3" />
                <p className="text-lg font-medium text-slate-800">{selectedFile.name}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                  className="mt-3 text-sm text-slate-600 hover:text-red-600"
                >
                  ファイルを変更
                </button>
              </div>
            ) : (
              <div>
                <UploadCloudIcon className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-lg font-medium text-slate-700">
                  ファイルをドラッグ＆ドロップ
                </p>
                <p className="text-sm text-slate-500 mt-1">または クリックしてファイルを選択</p>
                <p className="text-xs text-slate-400 mt-2">対応形式: CSV（5MB以下）</p>
              </div>
            )}
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* プレビュー */}
          {previewData && previewData.length > 0 && uploadStatus === 'idle' && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-700 mb-2">プレビュー（先頭5行）</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {previewData[0]?.map((header, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(1).map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-slate-100">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[150px] truncate"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* アップロードボタン */}
          {selectedFile && uploadStatus === 'idle' && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleUpload}
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UploadIcon className="w-4 h-4 mr-2" />
                アップロードして登録
              </button>
            </div>
          )}
        </section>

        {/* 進捗表示 */}
        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-lg font-medium text-slate-800">
                {uploadStatus === 'uploading' ? 'アップロード中...' : '登録処理中...'}
              </p>
              <div className="mt-4 w-full bg-slate-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="mt-2 text-sm text-slate-500">{uploadProgress}%</p>
            </div>
          </section>
        )}

        {/* 登録結果 */}
        {result && (uploadStatus === 'success' || uploadStatus === 'error') && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <ResultIcon className="w-5 h-5 text-blue-600" />
              登録結果
            </h2>

            {/* サマリー */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{result.successCount}</p>
                <p className="text-sm text-green-700 mt-1">成功</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{result.errorCount}</p>
                <p className="text-sm text-red-700 mt-1">エラー</p>
              </div>
            </div>

            {/* エラー詳細 */}
            {result.errorCount > 0 && result.errors && result.errors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-700 mb-2">エラー詳細</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <ul className="space-y-2 text-sm">
                    {result.errors.slice(0, 10).map((err, index) => (
                      <li key={index} className="flex items-start gap-2 text-red-700">
                        <span className="font-medium shrink-0">行{err.row}:</span>
                        <span>{err.message}</span>
                        {err.propertyId && (
                          <span className="text-red-500">({err.propertyId})</span>
                        )}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-red-500">
                        ...他 {result.errors.length - 10} 件のエラー
                      </li>
                    )}
                  </ul>
                </div>

                {/* エラーCSVダウンロード */}
                {result.errorFileUrl && (
                  <button
                    onClick={handleDownloadErrorFile}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    エラーCSVをダウンロード
                  </button>
                )}
              </div>
            )}

            {/* 完了メッセージ */}
            {result.successCount > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">
                  {result.successCount}件の物件を登録しました。
                </p>
              </div>
            )}

            {/* アクションボタン */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                別のファイルをアップロード
              </button>
              <button
                onClick={() => {
                  window.location.href = '/properties';
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                物件一覧へ
              </button>
            </div>
          </section>
        )}

        {/* 注意事項 */}
        <section className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-2">
            <WarningIcon className="w-4 h-4" />
            注意事項
          </h3>
          <ul className="text-sm text-yellow-700 space-y-2">
            <li>• CSVファイルは<strong>UTF-8</strong>形式で保存してください</li>
            <li>• 1行目はヘッダー行として扱われます</li>
            <li>• 必須は<strong>物件ID</strong>のみです（物件名・大項目・住所などは任意）</li>
            <li>• 既存の物件IDと重複する場合はエラーになります</li>
            <li>• 一度に登録できるのは最大1,000件までです</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

// ========================================
// ステップカード
// ========================================
interface StepCardProps {
  number: number;
  title: string;
  description: string;
}

function StepCard({ number, title, description }: StepCardProps) {
  return (
    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600 mt-1">{description}</p>
      </div>
    </div>
  );
}

// ========================================
// アイコンコンポーネント
// ========================================
function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function UploadCloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ResultIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function DesktopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}






