/**
 * G04: 物件詳細 + G05: ファイル一覧
 *
 * 画面仕様:
 * - 基本情報（読み取り専用）
 * - 編集ボタン（PCのみ）
 * - ファイルタブ（写真/図面/PDF/動画/その他）
 * - 地図ボタンクリックで位置確認
 *
 * 認可: internal / admin
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getProperty, getUploadUrl, uploadFileToS3, getPropertyFiles, FileInfo } from '../api/properties';
import { Property } from '../types/property';

// 1物件あたりの最大ファイル数（カテゴリごと）
const MAX_FILES_PER_CATEGORY = 50;

// ファイルタイプ定義
type FileType = 'photo' | 'drawing' | 'pdf' | 'movie' | 'others';

const FILE_TABS: { key: FileType; label: string; icon: React.ReactNode }[] = [
  { key: 'photo', label: '写真', icon: <PhotoIcon className="w-4 h-4" /> },
  { key: 'drawing', label: '図面', icon: <DrawingIcon className="w-4 h-4" /> },
  { key: 'pdf', label: 'PDF', icon: <PdfIcon className="w-4 h-4" /> },
  { key: 'movie', label: '動画', icon: <MovieIcon className="w-4 h-4" /> },
  { key: 'others', label: 'その他', icon: <FileIcon className="w-4 h-4" /> },
];

export default function PropertyDetail() {
  const params = useParams();
  
  // URLからIDを取得（静的エクスポート対応）
  const [propertyId, setPropertyId] = React.useState<string>('');
  
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // URLパスから物件IDを抽出: /properties/{id}/ or /properties/{id}
      const pathMatch = window.location.pathname.match(/\/properties\/([^\/]+)/);
      if (pathMatch && pathMatch[1] && pathMatch[1] !== 'placeholder') {
        setPropertyId(pathMatch[1]);
      } else if (params?.id && params.id !== 'placeholder') {
        setPropertyId(params.id as string);
      }
      
      // URLパラメータからタブを取得
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'files') {
        setActiveTab('files');
      }
    }
  }, [params]);

  // ========================================
  // State
  // ========================================
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // タブ
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info');
  const [activeFileTab, setActiveFileTab] = useState<FileType>('photo');

  // ファイル関連
  const [files, setFiles] = useState<{
    photo: FileInfo[];
    drawing: FileInfo[];
    pdf: FileInfo[];
    movie: FileInfo[];
    others: FileInfo[];
  }>({
    photo: [],
    drawing: [],
    pdf: [],
    movie: [],
    others: [],
  });
  const [filesLoading, setFilesLoading] = useState(false);

  // ファイルアップロード
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // 地図モーダル
  const [showMap, setShowMap] = useState(false);

  // 全ファイル数の計算
  const totalFileCount = Object.values(files).reduce((sum, arr) => sum + arr.length, 0);
  const currentCategoryCount = files[activeFileTab]?.length || 0;

  // ========================================
  // データ取得
  // ========================================
  const fetchProperty = useCallback(async () => {
    if (!propertyId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getProperty(propertyId);
      if (response.status === 'success') {
        setProperty(response.data);
      } else {
        setError('物件データの取得に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  // ファイル一覧取得
  const fetchFiles = useCallback(async () => {
    if (!propertyId) return;

    setFilesLoading(true);

    try {
      const response = await getPropertyFiles(propertyId);
      if (response.status === 'success') {
        setFiles(response.data);
      }
    } catch (err) {
      console.error('ファイル取得エラー:', err);
    } finally {
      setFilesLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  // ファイルタブが選択されたときにファイル一覧を取得
  useEffect(() => {
    if (activeTab === 'files' && propertyId) {
      fetchFiles();
    }
  }, [activeTab, propertyId, fetchFiles]);

  // ========================================
  // ファイルアップロード
  // ========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || !property) return;

    // 50ファイル制限チェック
    const currentCount = files[activeFileTab]?.length || 0;
    const newTotalCount = currentCount + selectedFiles.length;

    if (newTotalCount > MAX_FILES_PER_CATEGORY) {
      alert(`${activeFileTab}カテゴリは最大${MAX_FILES_PER_CATEGORY}ファイルまでです。\n現在: ${currentCount}ファイル\n追加可能: ${MAX_FILES_PER_CATEGORY - currentCount}ファイル`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress('アップロード準備中...');

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(`${file.name} をアップロード中... (${i + 1}/${selectedFiles.length})`);

        // 署名付きURL取得
        const urlResponse = await getUploadUrl(
          property.propertyId,
          activeFileTab,
          file.name
        );

        // S3にアップロード
        await uploadFileToS3(urlResponse.uploadUrl, file, urlResponse.contentType);
      }

      setUploadProgress('アップロード完了！');
      // ファイル一覧を再取得
      await fetchFiles();

      setTimeout(() => setUploadProgress(null), 2000);
    } catch (err) {
      setUploadProgress(null);
      alert(err instanceof Error ? err.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
      // input をリセット
      e.target.value = '';
    }
  };

  // ========================================
  // イベントハンドラー
  // ========================================
  const handleEdit = () => {
    window.location.href = `/properties/${propertyId}/edit`;
  };

  const handleBack = () => {
    window.location.href = '/properties';
  };

  const handleOpenMap = () => {
    if (property?.lat && property?.lng) {
      // Google Maps で開く
      window.open(
        `https://www.google.com/maps?q=${property.lat},${property.lng}`,
        '_blank'
      );
    }
  };

  // ========================================
  // ローディング・エラー
  // ========================================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '物件が見つかりません'}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            一覧に戻る
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <BackIcon className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-slate-800 truncate max-w-md">
                {property.name}
              </h1>
            </div>
            {/* 編集ボタン（PCのみ） */}
            <button
              onClick={handleEdit}
              className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <EditIcon className="w-4 h-4 mr-2" />
              編集
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* タブ切替 */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'info'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-800'
            }`}
          >
            基本情報
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'files'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-800'
            }`}
          >
            ファイル
          </button>
        </div>

        {/* 基本情報タブ */}
        {activeTab === 'info' && (
          <PropertyInfoTab property={property} onOpenMap={handleOpenMap} />
        )}

        {/* ファイルタブ */}
        {activeTab === 'files' && (
          <PropertyFilesTab
            property={property}
            files={files}
            filesLoading={filesLoading}
            activeFileTab={activeFileTab}
            setActiveFileTab={setActiveFileTab}
            onFileUpload={handleFileUpload}
            uploading={uploading}
            uploadProgress={uploadProgress}
            maxFilesPerCategory={MAX_FILES_PER_CATEGORY}
          />
        )}
      </main>
    </div>
  );
}

// ========================================
// 基本情報タブ
// ========================================
interface PropertyInfoTabProps {
  property: Property;
  onOpenMap: () => void;
}

function PropertyInfoTab({ property, onOpenMap }: PropertyInfoTabProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* 所在地セクション */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              所在地
            </h3>
            <p className="text-lg text-slate-800">
              〒{formatZipcode(property.zipcode)}
            </p>
            <p className="text-lg text-slate-800">
              {property.prefecture}
              {property.city}
              {property.address}
            </p>
          </div>
          {property.lat && property.lng && (
            <button
              onClick={onOpenMap}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <MapIcon className="w-4 h-4 mr-2" />
              地図で確認
            </button>
          )}
        </div>
        {property.lat && property.lng && (
          <p className="text-xs text-slate-400 mt-2">
            緯度: {property.lat}, 経度: {property.lng}
          </p>
        )}
      </div>

      {/* 物件情報グリッド */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoItem label="物件ID" value={property.propertyId} />
        <InfoItem label="物件名" value={property.name} />
        <InfoItem label="大項目" value={property.typeLarge} highlight />
        <InfoItem label="中項目" value={property.typeMedium} />
        <InfoItem label="小項目" value={property.typeSmall} />
        <InfoItem label="用途地域" value={property.landUse} />
        <InfoItem label="構造" value={property.structure} />
        <InfoItem label="面積" value={property.area ? `${property.area} ㎡` : undefined} />
        <InfoItem label="施主" value={property.owner} />
        <InfoItem label="担当者" value={property.staff} />
        <InfoItem
          label="引渡時期"
          value={property.deliveryDate ? formatDate(property.deliveryDate) : undefined}
        />
        <div className="md:col-span-2">
          <InfoItem label="備考" value={property.memo} />
        </div>
      </div>

      {/* メタ情報 */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
        <div className="flex gap-6 text-xs text-slate-400">
          {property.createdAt && (
            <span>作成日: {new Date(property.createdAt).toLocaleString('ja-JP')}</span>
          )}
          {property.updatedAt && (
            <span>更新日: {new Date(property.updatedAt).toLocaleString('ja-JP')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// ファイルタブ
// ========================================
interface PropertyFilesTabProps {
  property: Property;
  files: {
    photo: FileInfo[];
    drawing: FileInfo[];
    pdf: FileInfo[];
    movie: FileInfo[];
    others: FileInfo[];
  };
  filesLoading: boolean;
  activeFileTab: FileType;
  setActiveFileTab: (tab: FileType) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  uploadProgress: string | null;
  maxFilesPerCategory: number;
}

function PropertyFilesTab({
  files,
  filesLoading,
  activeFileTab,
  setActiveFileTab,
  onFileUpload,
  uploading,
  uploadProgress,
  maxFilesPerCategory,
}: PropertyFilesTabProps) {
  const currentFiles = files[activeFileTab] || [];
  const currentCount = currentFiles.length;
  const canUploadMore = currentCount < maxFilesPerCategory;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* ファイルタイプタブ */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {FILE_TABS.map((tab) => {
          const count = (files[tab.key] || []).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFileTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeFileTab === tab.key
                  ? 'text-blue-600 border-blue-600 bg-blue-50/50'
                  : 'text-slate-600 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              {tab.label}
              {count > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* アップロードエリア */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">
              {FILE_TABS.find((t) => t.key === activeFileTab)?.label}をアップロード
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {currentCount} / {maxFilesPerCategory} ファイル
              {!canUploadMore && (
                <span className="ml-2 text-red-500">（上限に達しました）</span>
              )}
            </p>
          </div>
          <label className="relative">
            <input
              type="file"
              multiple
              onChange={onFileUpload}
              disabled={uploading || !canUploadMore}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              accept={getAcceptTypes(activeFileTab)}
            />
            <span
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                uploading || !canUploadMore
                  ? 'text-slate-400 bg-slate-200 cursor-not-allowed'
                  : 'text-white bg-blue-600 hover:bg-blue-700 cursor-pointer'
              }`}
            >
              <UploadIcon className="w-4 h-4 mr-2" />
              ファイルを選択
            </span>
          </label>
        </div>
        {uploadProgress && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            {uploadProgress}
          </div>
        )}
      </div>

      {/* ファイル一覧 */}
      <div className="p-6">
        {filesLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-slate-500">ファイルを読み込み中...</p>
          </div>
        ) : currentFiles.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
              <FileIcon className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500">
              {FILE_TABS.find((t) => t.key === activeFileTab)?.label}はありません
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentFiles.map((file, index) => (
              <FileCard
                key={file.key || index}
                fileInfo={file}
                fileType={activeFileTab}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// ファイルカード
// ========================================
interface FileCardProps {
  fileInfo: FileInfo;
  fileType: FileType;
}

function FileCard({ fileInfo, fileType }: FileCardProps) {
  const handleClick = () => {
    window.open(fileInfo.url, '_blank');
  };

  // ファイルサイズをフォーマット
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={handleClick}
      className="group bg-slate-50 rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
    >
      {/* サムネイル */}
      <div className="aspect-square bg-slate-100 flex items-center justify-center">
        {fileType === 'photo' ? (
          <img
            src={fileInfo.url}
            alt={fileInfo.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="text-slate-400">
            {fileType === 'pdf' && <PdfIcon className="w-12 h-12" />}
            {fileType === 'drawing' && <DrawingIcon className="w-12 h-12" />}
            {fileType === 'movie' && <MovieIcon className="w-12 h-12" />}
            {fileType === 'others' && <FileIcon className="w-12 h-12" />}
          </div>
        )}
      </div>
      {/* ファイル名とサイズ */}
      <div className="p-2">
        <p className="text-xs text-slate-600 truncate group-hover:text-blue-600">
          {fileInfo.name}
        </p>
        {fileInfo.size && (
          <p className="text-xs text-slate-400 mt-0.5">
            {formatFileSize(fileInfo.size)}
          </p>
        )}
      </div>
    </div>
  );
}

// ========================================
// 情報項目コンポーネント
// ========================================
interface InfoItemProps {
  label: string;
  value?: string | number;
  highlight?: boolean;
}

function InfoItem({ label, value, highlight }: InfoItemProps) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </dt>
      <dd
        className={`text-sm ${
          value
            ? highlight
              ? 'text-blue-600 font-semibold'
              : 'text-slate-800'
            : 'text-slate-400'
        }`}
      >
        {value || '未設定'}
      </dd>
    </div>
  );
}

// ========================================
// ヘルパー関数
// ========================================
function formatZipcode(zipcode?: string): string {
  if (!zipcode) return '';
  if (zipcode.length === 7) {
    return `${zipcode.slice(0, 3)}-${zipcode.slice(3)}`;
  }
  return zipcode;
}

function formatDate(dateStr: string): string {
  if (dateStr.length === 8) {
    // YYYYMMDD 形式
    return `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

function getAcceptTypes(fileType: FileType): string {
  switch (fileType) {
    case 'photo':
      return 'image/*';
    case 'pdf':
      return '.pdf';
    case 'movie':
      return 'video/*';
    case 'drawing':
      return '.dwg,.dxf,.pdf,image/*';
    default:
      return '*/*';
  }
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

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function DrawingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function MovieIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
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

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}






