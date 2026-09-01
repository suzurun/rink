/**
 * G06: 物件登録フォーム（PC限定）
 *
 * 画面仕様:
 * - PC限定表示
 * - 入力項目：DynamoDB テーブル定義に準拠
 * - 必須項目：propertyId, name, zipcode, prefecture, city, address, typeLarge
 * - 地図検索（住所 → 緯度経度自動取得）
 * - 登録ボタンで POST /properties を呼び出し
 *
 * 認可: internal / admin
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getFreshIdToken } from '../api/auth';
import {
  TYPE_LARGE_OPTIONS,
  TYPE_MEDIUM_OPTIONS,
  STRUCTURE_OPTIONS,
  LAND_USE_OPTIONS,
  RBS_OPTIONS,
  OWNERSHIP_TYPE_OPTIONS,
} from '../types/property';
import HomeLogo from '../components/HomeLogo';

// API ベース URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// 都道府県リスト
const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

// フォームデータの型
interface PropertyFormData {
  propertyId: string;
  rbs: string;
  ownershipType: string;
  name: string;
  zipcode: string;
  prefecture: string;
  city: string;
  address: string;
  lat: string;
  lng: string;
  typeLarge: string;
  typeMedium: string;
  typeSmall: string;
  landUse: string;
  structure: string;
  area: string;
  owner: string;
  staff: string;
  deliveryDate: string;
  memo: string;
}

// 初期値
const initialFormData: PropertyFormData = {
  propertyId: '',
  rbs: '',
  ownershipType: '',
  name: '',
  zipcode: '',
  prefecture: '',
  city: '',
  address: '',
  lat: '',
  lng: '',
  typeLarge: '',
  typeMedium: '',
  typeSmall: '',
  landUse: '',
  structure: '',
  area: '',
  owner: '',
  staff: '',
  deliveryDate: '',
  memo: '',
};

export default function PropertyRegister() {
  // State
  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<PropertyFormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  // 保存完了後など、こちらの意図で画面遷移するときは離脱警告を出さない。
  // hasChanges の更新は次の再描画まで反映されず、遷移に間に合わないため ref で判定する。
  const skipUnloadWarningRef = useRef(false);

  // モバイル検出
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 画面離脱時の警告
  useEffect(() => {
    if (!hasChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 保存後の遷移では警告しない
      if (skipUnloadWarningRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // 中項目の選択肢（大項目に連動）
  const mediumOptions = formData.typeLarge
    ? TYPE_MEDIUM_OPTIONS[formData.typeLarge] || []
    : [];

  // ========================================
  // フォーム入力ハンドラー
  // ========================================
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      // 大項目が変更されたら中項目をリセット
      if (name === 'typeLarge') {
        newData.typeMedium = '';
        newData.typeSmall = '';
      }

      return newData;
    });

    setHasChanges(true);

    // エラーをクリア
    if (errors[name as keyof PropertyFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // ========================================
  // 郵便番号から住所を取得
  // ========================================
  const handleZipcodeSearch = async () => {
    const zipcode = formData.zipcode.replace(/-/g, '');
    if (zipcode.length !== 7) {
      setErrors((prev) => ({ ...prev, zipcode: '郵便番号は7桁で入力してください' }));
      return;
    }

    try {
      const response = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        setFormData((prev) => ({
          ...prev,
          prefecture: result.address1,
          city: result.address2 + result.address3,
        }));
        setHasChanges(true);
      } else {
        setErrors((prev) => ({ ...prev, zipcode: '住所が見つかりませんでした' }));
      }
    } catch {
      setErrors((prev) => ({ ...prev, zipcode: '住所の取得に失敗しました' }));
    }
  };

  // ========================================
  // 住所から緯度経度を取得（Geocoding）
  // ========================================
  const geocodeFromAddress = useCallback(async (prefecture: string, city: string, address: string) => {
    const fullAddress = `${prefecture}${city}${address}`;
    if (!fullAddress.trim()) return;

    setGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&countrycodes=jp`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        setFormData((prev) => ({
          ...prev,
          lat: parseFloat(data[0].lat).toFixed(6),
          lng: parseFloat(data[0].lon).toFixed(6),
        }));
        setHasChanges(true);
      }
    } catch {
      // 自動取得失敗は無視（手動入力も可能）
    } finally {
      setGeocoding(false);
    }
  }, []);

  const handleGeocode = async () => {
    if (!formData.prefecture || !formData.city.trim() || !formData.address.trim()) {
      setErrors((prev) => ({ ...prev, address: '住所を入力してください' }));
      return;
    }
    await geocodeFromAddress(formData.prefecture, formData.city, formData.address);
    if (!formData.lat && !formData.lng) {
      alert('緯度経度が取得できませんでした。手動で入力してください。');
    }
  };

  // 住所が揃ったら自動でジオコーディング
  useEffect(() => {
    if (formData.prefecture && formData.city.trim() && formData.address.trim() && !formData.lat && !formData.lng) {
      const timer = setTimeout(() => {
        geocodeFromAddress(formData.prefecture, formData.city, formData.address);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [formData.prefecture, formData.city, formData.address, formData.lat, formData.lng, geocodeFromAddress]);

  // ========================================
  // バリデーション
  // ========================================
  const validate = (): boolean => {
    const newErrors: Partial<PropertyFormData> = {};

    if (!formData.propertyId.trim()) {
      newErrors.propertyId = '物件IDは必須です';
    } else if (!/^[A-Za-z0-9_-]+$/.test(formData.propertyId)) {
      newErrors.propertyId = '物件IDは英数字、ハイフン、アンダースコアのみ使用できます';
    }

    if (!formData.name.trim()) {
      newErrors.name = '物件名は必須です';
    }

    if (!formData.zipcode.trim()) {
      newErrors.zipcode = '郵便番号は必須です';
    }

    if (!formData.prefecture) {
      newErrors.prefecture = '都道府県は必須です';
    }

    if (!formData.city.trim()) {
      newErrors.city = '市区町村は必須です';
    }

    if (!formData.address.trim()) {
      newErrors.address = '番地は必須です';
    }

    if (!formData.typeLarge) {
      newErrors.typeLarge = '大項目は必須です';
    }

    // 数値フィールドの検証
    if (formData.lat && isNaN(parseFloat(formData.lat))) {
      newErrors.lat = '緯度は数値で入力してください';
    }

    if (formData.lng && isNaN(parseFloat(formData.lng))) {
      newErrors.lng = '経度は数値で入力してください';
    }

    if (formData.area && isNaN(parseFloat(formData.area))) {
      newErrors.area = '面積は数値で入力してください';
    }

    // 日付フォーマット検証
    if (formData.deliveryDate && !/^\d{8}$/.test(formData.deliveryDate)) {
      newErrors.deliveryDate = '引渡時期はYYYYMMDD形式で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ========================================
  // フォーム送信
  // ========================================
  const submitForm = async (redirectOverride?: string) => {
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const token = await getFreshIdToken();

      // 送信データを構築
      const submitData: Record<string, any> = {
        propertyId: formData.propertyId.trim(),
        name: formData.name.trim(),
        zipcode: formData.zipcode.replace(/-/g, ''),
        prefecture: formData.prefecture,
        city: formData.city.trim(),
        address: formData.address.trim(),
        typeLarge: formData.typeLarge,
      };

      // オプション項目（空でなければ追加）
      if (formData.rbs) submitData.rbs = formData.rbs;
      if (formData.ownershipType) submitData.ownershipType = formData.ownershipType;
      if (formData.lat) submitData.lat = parseFloat(formData.lat);
      if (formData.lng) submitData.lng = parseFloat(formData.lng);
      if (formData.typeMedium) submitData.typeMedium = formData.typeMedium;
      if (formData.typeSmall) submitData.typeSmall = formData.typeSmall.trim();
      if (formData.landUse) submitData.landUse = formData.landUse;
      if (formData.structure) submitData.structure = formData.structure;
      if (formData.area) submitData.area = parseFloat(formData.area);
      if (formData.owner) submitData.owner = formData.owner.trim();
      if (formData.staff) submitData.staff = formData.staff.trim();
      if (formData.deliveryDate) submitData.deliveryDate = formData.deliveryDate;
      if (formData.memo) submitData.memo = formData.memo.trim();

      const response = await fetch(`${API_BASE_URL}/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setSubmitError('この物件IDは既に使用されています');
        } else {
          setSubmitError(result.message || '登録に失敗しました');
        }
        return;
      }

      // 成功時は詳細画面へ遷移
      alert('物件を登録しました');
      setHasChanges(false);
      skipUnloadWarningRef.current = true;
      const redirectTo = redirectOverride || pendingRedirect || `/properties/${formData.propertyId}`;
      setPendingRedirect(null);
      window.location.href = redirectTo;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm();
  };

  // ========================================
  // 画面遷移（未保存時の確認）
  // ========================================
  const handleNavigate = (target: string) => {
    if (!hasChanges) {
      window.location.href = target;
      return;
    }

    const shouldSave = confirm('未保存の変更があります。保存しますか？');
    if (shouldSave) {
      setPendingRedirect(target);
      submitForm(target);
    } else {
      // 破棄を選んだ後にブラウザの離脱確認まで出すと二重確認になる
      skipUnloadWarningRef.current = true;
      window.location.href = target;
    }
  };

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
            物件登録はPCからのみ可能です。
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
            <div className="flex items-center gap-3 sm:gap-4">
              <HomeLogo divider />
              <button
                onClick={() => handleNavigate('/properties')}
                className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              >
                <BackIcon className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-slate-800">物件登録</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* エラーメッセージ */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          {/* 変更通知 */}
          {hasChanges && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-700 flex items-center">
                <AlertIcon className="w-4 h-4 mr-2" />
                未保存の変更があります
              </p>
            </div>
          )}

          {/* 基本情報 */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <InfoIcon className="w-5 h-5 text-blue-600" />
              基本情報
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 物件ID */}
              <FormField
                label="物件ID"
                name="propertyId"
                value={formData.propertyId}
                onChange={handleChange}
                error={errors.propertyId}
                required
                placeholder="例: P0001"
                helpText="英数字、ハイフン、アンダースコアのみ"
              />

              {/* RBS（該当する物件だけ選ぶ。空欄のままで構わない） */}
              <FormSelect
                label="RBS"
                name="rbs"
                value={formData.rbs}
                onChange={handleChange}
                options={RBS_OPTIONS}
                placeholder="該当しない場合は空欄"
              />

              {/* 物件区分（リンクの物件か、預かりの物件か） */}
              <FormSelect
                label="物件区分"
                name="ownershipType"
                value={formData.ownershipType}
                onChange={handleChange}
                options={OWNERSHIP_TYPE_OPTIONS}
                placeholder="未定の場合は空欄"
              />

              {/* 物件名 */}
              <FormField
                label="物件名"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                required
                placeholder="例: 大谷ビル"
              />
            </div>
          </section>

          {/* 所在地 */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <LocationIcon className="w-5 h-5 text-blue-600" />
              所在地
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 郵便番号 */}
              <div>
                <FormField
                  label="郵便番号"
                  name="zipcode"
                  value={formData.zipcode}
                  onChange={handleChange}
                  error={errors.zipcode}
                  required
                  placeholder="例: 8100004"
                />
                <button
                  type="button"
                  onClick={handleZipcodeSearch}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  郵便番号から住所を検索
                </button>
              </div>

              {/* 都道府県 */}
              <FormSelect
                label="都道府県"
                name="prefecture"
                value={formData.prefecture}
                onChange={handleChange}
                error={errors.prefecture}
                required
                options={PREFECTURES}
                placeholder="選択してください"
              />

              {/* 市区町村 */}
              <FormField
                label="市区町村"
                name="city"
                value={formData.city}
                onChange={handleChange}
                error={errors.city}
                required
                placeholder="例: 福岡市中央区"
              />

              {/* 番地 */}
              <FormField
                label="番地"
                name="address"
                value={formData.address}
                onChange={handleChange}
                error={errors.address}
                required
                placeholder="例: 薬院1-1-1"
              />

              {/* 緯度 */}
              <FormField
                label="緯度"
                name="lat"
                type="number"
                step="0.000001"
                value={formData.lat}
                onChange={handleChange}
                error={errors.lat}
                placeholder="例: 33.583000"
              />

              {/* 経度 */}
              <FormField
                label="経度"
                name="lng"
                type="number"
                step="0.000001"
                value={formData.lng}
                onChange={handleChange}
                error={errors.lng}
                placeholder="例: 130.394000"
              />
            </div>

            {/* 住所から緯度経度を取得 */}
            <button
              type="button"
              onClick={handleGeocode}
              disabled={geocoding}
              className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              {geocoding ? (
                <>
                  <LoadingIcon className="w-4 h-4 mr-2 animate-spin" />
                  取得中...
                </>
              ) : (
                <>
                  <MapPinIcon className="w-4 h-4 mr-2" />
                  住所から緯度経度を取得
                </>
              )}
            </button>
          </section>

          {/* 物件種別 */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <CategoryIcon className="w-5 h-5 text-blue-600" />
              物件種別
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 大項目 */}
              <FormSelect
                label="大項目"
                name="typeLarge"
                value={formData.typeLarge}
                onChange={handleChange}
                error={errors.typeLarge}
                required
                options={TYPE_LARGE_OPTIONS}
                placeholder="選択してください"
              />

              {/* 中項目 */}
              <FormSelect
                label="中項目"
                name="typeMedium"
                value={formData.typeMedium}
                onChange={handleChange}
                options={mediumOptions}
                placeholder="選択してください"
                disabled={!formData.typeLarge}
              />

              {/* 小項目 */}
              <FormField
                label="小項目"
                name="typeSmall"
                value={formData.typeSmall}
                onChange={handleChange}
                placeholder="自由入力"
              />
            </div>
          </section>

          {/* 建物情報 */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <BuildingIcon className="w-5 h-5 text-blue-600" />
              建物情報
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 用途地域 */}
              <FormSelect
                label="用途地域"
                name="landUse"
                value={formData.landUse}
                onChange={handleChange}
                options={LAND_USE_OPTIONS}
                placeholder="選択してください"
              />

              {/* 構造 */}
              <FormSelect
                label="構造"
                name="structure"
                value={formData.structure}
                onChange={handleChange}
                options={STRUCTURE_OPTIONS}
                placeholder="選択してください"
              />

              {/* 面積 */}
              <FormField
                label="面積（㎡）"
                name="area"
                type="number"
                step="0.01"
                value={formData.area}
                onChange={handleChange}
                error={errors.area}
                placeholder="例: 200"
              />

              {/* 引渡時期 */}
              <FormField
                label="引渡時期"
                name="deliveryDate"
                value={formData.deliveryDate}
                onChange={handleChange}
                error={errors.deliveryDate}
                placeholder="YYYYMMDD（例: 20241201）"
                helpText="年月日を8桁で入力"
              />
            </div>
          </section>

          {/* 担当者情報 */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-blue-600" />
              担当者情報
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 施主 */}
              <FormField
                label="施主"
                name="owner"
                value={formData.owner}
                onChange={handleChange}
                placeholder="例: 山田太郎"
              />

              {/* 担当者 */}
              <FormField
                label="担当者（社内）"
                name="staff"
                value={formData.staff}
                onChange={handleChange}
                placeholder="例: 佐藤"
              />
            </div>
          </section>

          {/* 備考 */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <NoteIcon className="w-5 h-5 text-blue-600" />
              備考
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                備考・メモ
              </label>
              <textarea
                name="memo"
                value={formData.memo}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="その他の情報を入力..."
              />
            </div>
          </section>

          {/* 送信ボタン */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => handleNavigate('/properties')}
              className="px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center">
                  <LoadingIcon className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </span>
              ) : (
                '保存する'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

// ========================================
// フォーム部品コンポーネント
// ========================================
interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  type?: string;
  step?: string;
}

function FormField({
  label,
  name,
  value,
  onChange,
  error,
  required,
  placeholder,
  helpText,
  type = 'text',
  step,
}: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        step={step}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
      />
      {helpText && !error && (
        <p className="mt-1 text-xs text-slate-500">{helpText}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface FormSelectProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  error?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
  error,
  required,
  placeholder,
  disabled,
}: FormSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:bg-slate-100 disabled:text-slate-400 ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
      >
        <option value="">{placeholder || '選択してください'}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CategoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}






