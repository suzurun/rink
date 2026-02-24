/**
 * FileUploader コンポーネント
 *
 * 機能:
 * - ドラッグ&ドロップ対応
 * - 複数ファイル同時アップロード
 * - プログレス表示
 * - ファイルタイプ制限
 * - ファイルサイズ制限
 * - S3 署名付きURL経由でアップロード
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { getUploadUrl, uploadFileToS3 } from '../api/properties';

// ファイルタイプ
export type FileType = 'photo' | 'drawing' | 'pdf' | 'movie' | 'others';

// ファイルタイプ設定
const FILE_TYPE_CONFIG: Record<
  FileType,
  {
    label: string;
    accept: string;
    maxSize: number; // bytes
    extensions: string[];
  }
> = {
  photo: {
    label: '写真',
    accept: 'image/jpeg,image/png,image/gif,image/webp,image/heic',
    maxSize: 50 * 1024 * 1024, // 50MB
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'],
  },
  drawing: {
    label: '図面',
    accept: '.dwg,.dxf,.pdf,image/*',
    maxSize: 100 * 1024 * 1024, // 100MB
    extensions: ['dwg', 'dxf', 'pdf', 'jpg', 'jpeg', 'png'],
  },
  pdf: {
    label: 'PDF',
    accept: 'application/pdf',
    maxSize: 100 * 1024 * 1024, // 100MB
    extensions: ['pdf'],
  },
  movie: {
    label: '動画',
    accept: 'video/mp4,video/quicktime,video/x-msvideo,video/webm',
    maxSize: 500 * 1024 * 1024, // 500MB
    extensions: ['mp4', 'mov', 'avi', 'webm'],
  },
  others: {
    label: 'その他',
    accept: '*/*',
    maxSize: 100 * 1024 * 1024, // 100MB
    extensions: [],
  },
};

// アップロード中のファイル状態
interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// Props
interface FileUploaderProps {
  propertyId: string;
  fileType: FileType;
  onUploadComplete?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function FileUploader({
  propertyId,
  fileType,
  onUploadComplete,
  onError,
  disabled = false,
  className = '',
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = FILE_TYPE_CONFIG[fileType];

  // ========================================
  // ファイルバリデーション
  // ========================================
  const validateFile = useCallback(
    (file: File): string | null => {
      // ファイルサイズチェック
      if (file.size > config.maxSize) {
        const maxSizeMB = Math.round(config.maxSize / 1024 / 1024);
        return `ファイルサイズが大きすぎます（最大 ${maxSizeMB}MB）`;
      }

      // 拡張子チェック（othersは全て許可）
      if (config.extensions.length > 0) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !config.extensions.includes(ext)) {
          return `対応していないファイル形式です（${config.extensions.join(', ')}）`;
        }
      }

      return null;
    },
    [config]
  );

  // ========================================
  // ファイルアップロード処理
  // ========================================
  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || isUploading) return;

      // バリデーション
      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      }

      if (errors.length > 0) {
        onError?.(errors.join('\n'));
      }

      if (validFiles.length === 0) return;

      // アップロード状態を初期化
      const initialUploadingFiles: UploadingFile[] = validFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: 'pending',
      }));

      setUploadingFiles(initialUploadingFiles);
      setIsUploading(true);

      // 順次アップロード
      for (let i = 0; i < initialUploadingFiles.length; i++) {
        const uploadingFile = initialUploadingFiles[i];

        try {
          // ステータス更新: uploading
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id ? { ...f, status: 'uploading', progress: 10 } : f
            )
          );

          // 署名付きURL取得
          const urlResponse = await getUploadUrl(
            propertyId,
            fileType,
            uploadingFile.file.name
          );

          // プログレス更新
          setUploadingFiles((prev) =>
            prev.map((f) => (f.id === uploadingFile.id ? { ...f, progress: 30 } : f))
          );

          // S3にアップロード
          await uploadFileToS3(
            urlResponse.uploadUrl,
            uploadingFile.file,
            urlResponse.contentType
          );

          // ステータス更新: success
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id ? { ...f, status: 'success', progress: 100 } : f
            )
          );
        } catch (err) {
          // ステータス更新: error
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id
                ? {
                    ...f,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'アップロードに失敗しました',
                  }
                : f
            )
          );
        }
      }

      setIsUploading(false);

      // 完了コールバック
      const successCount = initialUploadingFiles.filter(
        (f) => uploadingFiles.find((u) => u.id === f.id)?.status === 'success'
      ).length;

      if (successCount > 0) {
        onUploadComplete?.();
      }

      // 3秒後にリストをクリア
      setTimeout(() => {
        setUploadingFiles([]);
      }, 3000);
    },
    [propertyId, fileType, isUploading, validateFile, onUploadComplete, onError]
  );

  // ========================================
  // ドラッグ&ドロップハンドラー
  // ========================================
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const files = Array.from(e.dataTransfer.files);
      uploadFiles(files);
    },
    [disabled, isUploading, uploadFiles]
  );

  // ========================================
  // ファイル選択ハンドラー
  // ========================================
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      uploadFiles(files);

      // inputをリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  // ========================================
  // Render
  // ========================================
  return (
    <div className={className}>
      {/* ドロップゾーン */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : disabled || isUploading
              ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
              : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={config.accept}
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
        />

        <div className="space-y-3">
          {/* アイコン */}
          <div
            className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${
              isDragging ? 'bg-blue-100' : 'bg-slate-100'
            }`}
          >
            <UploadIcon
              className={`w-7 h-7 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`}
            />
          </div>

          {/* テキスト */}
          <div>
            <p className={`text-sm font-medium ${isDragging ? 'text-blue-600' : 'text-slate-700'}`}>
              {isDragging
                ? 'ここにドロップ'
                : isUploading
                ? 'アップロード中...'
                : `${config.label}をドラッグ&ドロップ`}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              またはクリックしてファイルを選択
            </p>
          </div>

          {/* 制限情報 */}
          <div className="text-xs text-slate-400">
            <p>
              対応形式: {config.extensions.length > 0 ? config.extensions.join(', ') : 'すべて'}
            </p>
            <p>最大サイズ: {Math.round(config.maxSize / 1024 / 1024)}MB</p>
          </div>
        </div>
      </div>

      {/* アップロード進捗 */}
      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadingFiles.map((uploadingFile) => (
            <UploadProgressItem key={uploadingFile.id} file={uploadingFile} />
          ))}
        </div>
      )}
    </div>
  );
}

// ========================================
// アップロード進捗アイテム
// ========================================
interface UploadProgressItemProps {
  file: UploadingFile;
}

function UploadProgressItem({ file }: UploadProgressItemProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-700 truncate">{file.file.name}</span>
        </div>
        <div className="flex-shrink-0 ml-2">
          {file.status === 'pending' && (
            <span className="text-xs text-slate-500">待機中</span>
          )}
          {file.status === 'uploading' && (
            <span className="text-xs text-blue-600">アップロード中</span>
          )}
          {file.status === 'success' && (
            <CheckIcon className="w-5 h-5 text-green-500" />
          )}
          {file.status === 'error' && (
            <ErrorIcon className="w-5 h-5 text-red-500" />
          )}
        </div>
      </div>

      {/* プログレスバー */}
      {(file.status === 'pending' || file.status === 'uploading') && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${file.progress}%` }}
          />
        </div>
      )}

      {/* エラーメッセージ */}
      {file.status === 'error' && file.error && (
        <p className="text-xs text-red-600 mt-1">{file.error}</p>
      )}
    </div>
  );
}

// ========================================
// アイコンコンポーネント
// ========================================
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}






