/**
 * G03: 地図ビュー
 *
 * 画面仕様:
 * - Google Maps API で物件をピン表示
 * - 物件一覧から緯度経度を取得
 * - ピンタップで物件詳細へ遷移
 * - iPad で見やすい UI
 * - 絞り込み機能
 *
 * 認可: internal / admin / external
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getProperties } from '../api/properties';
import { getFreshIdToken } from '../api/auth';
import { PropertyListItem, PropertySearchParams } from '../types/property';
import { PROPERTY_CATEGORIES } from '../config/propertyCategories';
import HomeLogo from '../components/HomeLogo';

// Google Maps API Key（環境変数から取得）
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// デフォルトのズームレベル
const DEFAULT_ZOOM = 12;
const MAX_ZOOM = 16;

// 凡例/マーカーカラー定義（追加・色変更すると凡例とマーカーに反映）
const LEGEND_DEFINITIONS = PROPERTY_CATEGORIES;

const MARKER_COLORS: Record<string, string> = LEGEND_DEFINITIONS.reduce(
  (acc, item) => {
    acc[item.type] = item.color;
    return acc;
  },
  {} as Record<string, string>
);

const LEGEND_COLLAPSE_BREAKPOINT = 640;
const LEGEND_SIMPLIFIED_ZOOM_THRESHOLD = 15;
const MARKER_SCALE_DEFAULT = 12;
const MARKER_SCALE_ZOOMED_OUT = 9;
const MARKER_SCALE_MOBILE_ZOOMED_IN = 6;
const MARKER_SCALE_THRESHOLD = 15;

const getMarkerScale = (zoom: number, isMobile: boolean) => {
  if (isMobile && zoom >= MARKER_SCALE_THRESHOLD) {
    return MARKER_SCALE_MOBILE_ZOOMED_IN;
  }
  return zoom < MARKER_SCALE_THRESHOLD ? MARKER_SCALE_ZOOMED_OUT : MARKER_SCALE_DEFAULT;
};

export default function MapView() {
  const router = useRouter();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // ========================================
  // State
  // ========================================
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);

  // フィルター
  const [showFilters, setShowFilters] = useState(false);
  const [typeLarge, setTypeLarge] = useState('');
  const [typeMedium, setTypeMedium] = useState('');
  const [keyword, setKeyword] = useState('');

  // カテゴリセグメント（複数選択可能、空=全表示）
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());

  // 選択中の物件
  const [selectedProperty, setSelectedProperty] = useState<PropertyListItem | null>(null);

  // 中項目の選択肢
  const mediumOptions = typeLarge
    ? LEGEND_DEFINITIONS.find((item) => item.type === typeLarge)?.mediumOptions || []
    : [];

  // カテゴリトグル
  const toggleCategory = useCallback((category: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const clearCategories = useCallback(() => {
    setActiveCategories(new Set());
  }, []);

  // カテゴリでフィルターした物件リスト
  const filteredProperties = useMemo(() => {
    if (activeCategories.size === 0) return properties;
    return properties.filter((p) => activeCategories.has(p.typeLarge));
  }, [properties, activeCategories]);

  // ========================================
  // 認証チェック（未ログインはログインへ誘導）
  // ========================================
  useEffect(() => {
    const checkAuth = async () => {
      // 保存済みトークンは 1 時間で切れるため、セッションから取り直して判定する
      const token = await getFreshIdToken();
      if (!token) {
        router.push('/login?redirect=/map');
        return;
      }
      setIsAuthenticated(true);
    };
    checkAuth();
  }, [router]);

  // ========================================
  // Google Maps API ロード
  // ========================================
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!GOOGLE_MAPS_API_KEY) {
      setMapError('Google Maps API キーが設定されていません');
      return;
    }

    // 既にロード済みかチェック
    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setMapLoaded(true);
    };

    script.onerror = () => {
      setMapError('Google Maps の読み込みに失敗しました');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup は不要（グローバルに読み込まれる）
    };
  }, [isAuthenticated]);

  // ========================================
  // 物件データ取得
  // ========================================
  const fetchProperties = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);

    try {
      const params: PropertySearchParams = {
        limit: 1000, // 地図用に全件取得
      };

      if (keyword.trim()) params.keyword = keyword.trim();
      if (typeLarge) params.typeLarge = typeLarge;
      if (typeMedium) params.typeMedium = typeMedium;

      const response = await getProperties(params);

      if (response.status === 'success') {
        // 緯度経度がある物件のみフィルタリング
        const propertiesWithLocation = response.data.filter(
          (p) => p.lat && p.lng
        );
        setProperties(propertiesWithLocation);
      } else {
        setError('データの取得に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [keyword, typeLarge, typeMedium, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
    fetchProperties();
    }
  }, [fetchProperties, isAuthenticated]);

  // ========================================
  // 物件の中央点を計算
  // ========================================
  const calculateCenter = useCallback((props: PropertyListItem[]): { lat: number; lng: number } | null => {
    const validProps = props.filter(p => p.lat && p.lng);
    if (validProps.length === 0) return null;

    const sumLat = validProps.reduce((sum, p) => sum + (p.lat || 0), 0);
    const sumLng = validProps.reduce((sum, p) => sum + (p.lng || 0), 0);

    return {
      lat: sumLat / validProps.length,
      lng: sumLng / validProps.length,
    };
  }, []);

  // ========================================
  // 地図初期化（物件データロード後に実行）
  // ========================================
  useEffect(() => {
    if (!mapLoaded || !window.google?.maps || loading || !isAuthenticated) return;

    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    // 既に初期化済みの場合はスキップ
    if (mapRef.current) return;

    // 物件の中央点を計算（物件がない場合は東京をデフォルトに）
    const center = calculateCenter(properties) || { lat: 35.6762, lng: 139.6503 };

    // 地図を初期化
    mapRef.current = new google.maps.Map(mapContainer, {
      center: center,
      zoom: DEFAULT_ZOOM,
      gestureHandling: 'greedy',
      scrollwheel: true,
      disableDoubleClickZoom: false,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER,
      },
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    // InfoWindow を作成
    infoWindowRef.current = new google.maps.InfoWindow();
    setMapZoom(mapRef.current.getZoom() ?? DEFAULT_ZOOM);
    setMapReady(true);
  }, [mapLoaded, loading, properties, calculateCenter, isAuthenticated]);

  // ========================================
  // ズーム監視
  // ========================================
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;

    const map = mapRef.current;
    const handleZoomChange = () => {
      const zoom = map.getZoom();
      if (typeof zoom === 'number') {
        setMapZoom(zoom);
      }
    };

    handleZoomChange();
    const listener = map.addListener('zoom_changed', handleZoomChange);

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [mapReady]);

  // ========================================
  // 地図の操作性を強制有効化
  // ========================================
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mapRef.current.setOptions({
      gestureHandling: 'greedy',
      scrollwheel: true,
      disableDoubleClickZoom: false,
      zoomControl: true,
      draggable: true,
      keyboardShortcuts: true,
    });
  }, [mapReady]);

  // ========================================
  // 画面幅監視（凡例の自動折りたたみ）
  // ========================================
  useEffect(() => {
    const handleResize = () => {
      const small = window.innerWidth < LEGEND_COLLAPSE_BREAKPOINT;
      setIsSmallScreen(small);
      setIsLegendCollapsed(small);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ========================================
  // マーカー描画
  // ========================================
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps || loading || !isAuthenticated) return;

    // 既存のマーカーを削除
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (filteredProperties.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    const currentZoom = mapRef.current?.getZoom() ?? DEFAULT_ZOOM;
    const isMobile = window.innerWidth < LEGEND_COLLAPSE_BREAKPOINT;

    filteredProperties.forEach((property) => {
      if (!property.lat || !property.lng) return;

      const position = { lat: property.lat, lng: property.lng };
      const color = MARKER_COLORS[property.typeLarge] || MARKER_COLORS['その他'];

      // カスタムマーカーアイコン
      const marker = new google.maps.Marker({
        position,
        map: mapRef.current,
        title: property.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: getMarkerScale(currentZoom, isMobile),
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        animation: google.maps.Animation.DROP,
      });

      // クリックイベント
      marker.addListener('click', () => {
        setSelectedProperty(property);

        // InfoWindow を表示
        const content = createInfoWindowContent(property);
        infoWindowRef.current?.setContent(content);
        infoWindowRef.current?.open(mapRef.current, marker);

        // InfoWindow 内のボタンにイベントを追加
        setTimeout(() => {
          const detailBtn = document.getElementById(`detail-btn-${property.propertyId}`);
          detailBtn?.addEventListener('click', () => {
            router.push(`/properties/${property.propertyId}`);
          });
        }, 100);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    // 全マーカーが見えるようにズーム調整
    if (filteredProperties.length > 0) {
      mapRef.current.fitBounds(bounds);

      // ズームが近すぎる場合は調整
      const listener = google.maps.event.addListener(mapRef.current, 'idle', () => {
        const zoom = mapRef.current?.getZoom();
        if (zoom && zoom > MAX_ZOOM) {
          mapRef.current?.setZoom(MAX_ZOOM);
        }
        google.maps.event.removeListener(listener);
      });
    }
  }, [filteredProperties, loading, router, isAuthenticated]);

  // ========================================
  // ズーム変更時にマーカーサイズを更新
  // ========================================
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps || markersRef.current.length === 0) return;

    const scale = getMarkerScale(mapZoom, isSmallScreen);
    markersRef.current.forEach((marker) => {
      const icon = marker.getIcon() as google.maps.Symbol | null;
      if (!icon || typeof icon === 'string') return;
      marker.setIcon({ ...icon, scale });
    });
  }, [mapZoom, isSmallScreen]);

  // ========================================
  // InfoWindow コンテンツ生成
  // ========================================
  const createInfoWindowContent = (property: PropertyListItem): string => {
    const color = MARKER_COLORS[property.typeLarge] || MARKER_COLORS['その他'];
    return `
      <div style="min-width: 200px; font-family: system-ui, sans-serif;">
        <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #1e293b;">
          ${escapeHtml(property.name)}
        </h3>
        <p style="margin: 0 0 4px; font-size: 13px; color: #64748b;">
          ${escapeHtml(property.prefecture)}${escapeHtml(property.city)}${escapeHtml(property.address)}
        </p>
        <div style="margin: 8px 0; display: flex; gap: 4px; flex-wrap: wrap;">
          <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 500; color: #fff; background: ${color}; border-radius: 12px;">
            ${escapeHtml(property.typeLarge)}
          </span>
          ${property.typeMedium ? `
            <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 500; color: #475569; background: #e2e8f0; border-radius: 12px;">
              ${escapeHtml(property.typeMedium)}
            </span>
          ` : ''}
        </div>
        ${property.staff ? `
          <p style="margin: 4px 0 8px; font-size: 12px; color: #94a3b8;">
            担当: ${escapeHtml(property.staff)}
          </p>
        ` : ''}
        <button
          id="detail-btn-${property.propertyId}"
          style="width: 100%; padding: 8px; font-size: 13px; font-weight: 500; color: #fff; background: #3b82f6; border: none; border-radius: 6px; cursor: pointer;"
        >
          詳細を見る
        </button>
      </div>
    `;
  };

  // ========================================
  // フィルター適用
  // ========================================
  const handleApplyFilters = () => {
    fetchProperties();
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setTypeLarge('');
    setTypeMedium('');
    setKeyword('');
  };

  // ========================================
  // 凡例データ
  // ========================================
  const legendItems = useMemo(() => {
    const simplified = mapZoom >= LEGEND_SIMPLIFIED_ZOOM_THRESHOLD;
    return LEGEND_DEFINITIONS.filter((item) => !simplified || item.isPrimary);
  }, [mapZoom]);

  // ========================================
  // Render
  // ========================================
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-slate-200 z-20">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center gap-2 md:gap-3">
              <HomeLogo divider />
              <button
                onClick={() => { window.location.href = '/properties'; }}
                className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <BackIcon className="w-5 h-5" />
              </button>
              <h1 className="text-lg md:text-xl font-bold text-slate-800">地図ビュー</h1>
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                {filteredProperties.length} 件
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* 一覧ビュー切替 */}
              <button
                onClick={() => { window.location.href = '/properties'; }}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <ListIcon className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">一覧</span>
              </button>

              {/* フィルターボタン */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
                  showFilters || typeLarge || keyword
                    ? 'text-blue-700 bg-blue-50 border-blue-300'
                    : 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50'
                }`}
              >
                <FilterIcon className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">絞り込み</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* カテゴリセグメントバー */}
      <div className="bg-white border-b border-slate-200 z-10">
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={clearCategories}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              activeCategories.size === 0
                ? 'text-white bg-slate-700 border-slate-700'
                : 'text-slate-600 bg-white border-slate-300 hover:bg-slate-50'
            }`}
          >
            すべて
          </button>
          {LEGEND_DEFINITIONS.map((cat) => {
            const isActive = activeCategories.has(cat.type);
            const count = properties.filter((p) => p.typeLarge === cat.type).length;
            return (
              <button
                key={cat.type}
                onClick={() => toggleCategory(cat.type)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  isActive
                    ? 'text-white border-transparent'
                    : 'text-slate-600 bg-white border-slate-300 hover:bg-slate-50'
                }`}
                style={isActive ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: isActive ? '#fff' : cat.color }}
                />
                {cat.type}
                {count > 0 && (
                  <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* フィルターパネル */}
      {showFilters && (
        <div className="bg-white border-b border-slate-200 p-4 z-10">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* キーワード */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  キーワード
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="物件名・住所"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 大項目 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  大項目
                </label>
                <select
                  value={typeLarge}
                  onChange={(e) => {
                    setTypeLarge(e.target.value);
                    setTypeMedium('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">すべて</option>
                  {LEGEND_DEFINITIONS.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.type}
                    </option>
                  ))}
                </select>
              </div>

              {/* 中項目 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  中項目
                </label>
                <select
                  value={typeMedium}
                  onChange={(e) => setTypeMedium(e.target.value)}
                  disabled={!typeLarge}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">すべて</option>
                  {mediumOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* ボタン */}
              <div className="flex items-end gap-2">
                <button
                  onClick={handleClearFilters}
                  className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  クリア
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  検索
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 地図エリア */}
      <div className="flex-1 relative">
        {/* ローディング */}
        {(loading || !mapLoaded) && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-slate-600">
                {!mapLoaded ? '地図を読み込み中...' : '物件データを取得中...'}
              </p>
            </div>
          </div>
        )}

        {/* エラー */}
        {(error || mapError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <ErrorIcon className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-red-600 mb-4">{mapError || error}</p>
              {!mapError && (
                <button
                  onClick={fetchProperties}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  再試行
                </button>
              )}
            </div>
          </div>
        )}

        {/* 地図コンテナ */}
        <div id="map-container" className="w-full h-full" />

        {/* 凡例（自動折りたたみ & ズームで簡略表示） */}
        {mapLoaded && !mapError && legendItems.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-10">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              凡例
            </h3>
              {isSmallScreen && (
                <button
                  onClick={() => setIsLegendCollapsed((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  {isLegendCollapsed ? '開く' : '閉じる'}
                  <ChevronIcon className={`w-3.5 h-3.5 transition-transform ${isLegendCollapsed ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            {!isLegendCollapsed && (
              <>
                {mapZoom >= LEGEND_SIMPLIFIED_ZOOM_THRESHOLD && (
                  <p className="text-[11px] text-slate-500 mb-2">
                    ズーム {LEGEND_SIMPLIFIED_ZOOM_THRESHOLD}+：主要カテゴリのみ表示
                  </p>
                )}
            <div className="space-y-1.5">
                  {legendItems.map((item) => (
                    <div key={item.type} className="flex items-center gap-2">
                  <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                  />
                      <span className="text-sm text-slate-700">{item.type}</span>
                </div>
              ))}
            </div>
              </>
            )}
          </div>
        )}

        {/* 物件数（モバイル用） */}
        {mapLoaded && !mapError && (
          <div className="absolute top-4 left-4 sm:hidden bg-white rounded-lg shadow-md px-3 py-1.5 z-10">
            <span className="text-sm font-medium text-slate-700">
              {filteredProperties.length} 件
            </span>
          </div>
        )}

        {/* 位置情報がない物件の通知 */}
        {mapLoaded && !loading && filteredProperties.length === 0 && !error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 z-10">
            <p className="text-sm text-yellow-700">
              表示できる物件がありません（緯度経度が設定された物件のみ表示）
            </p>
          </div>
        )}
      </div>

      {/* 選択中の物件カード（モバイル用） */}
      {selectedProperty && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-20 shadow-lg">
          <div className="flex items-start gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
              style={{
                backgroundColor:
                  MARKER_COLORS[selectedProperty.typeLarge] || MARKER_COLORS['その他'],
              }}
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 truncate">
                {selectedProperty.name}
              </h3>
              <p className="text-sm text-slate-600 truncate">
                {selectedProperty.prefecture}
                {selectedProperty.city}
                {selectedProperty.address}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                  {selectedProperty.typeLarge}
                </span>
                {selectedProperty.staff && (
                  <span className="text-xs text-slate-500">
                    担当: {selectedProperty.staff}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => router.push(`/properties/${selectedProperty.propertyId}`)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex-shrink-0"
            >
              詳細
            </button>
          </div>
          <button
            onClick={() => setSelectedProperty(null)}
            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ========================================
// ヘルパー関数
// ========================================
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// Google Maps 型定義（グローバル拡張）
declare global {
  interface Window {
    google: typeof google;
  }
}






