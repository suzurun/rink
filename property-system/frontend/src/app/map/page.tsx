/**
 * G03: 地図ビューページ（App Router エントリポイント）
 */

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('../../pages/MapView'), { ssr: false });

export default function MapViewPage() {
  return <MapView />;
}






