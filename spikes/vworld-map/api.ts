// 백엔드 /api/v1 연결 (Pugurin-backend feat/real-data-mode 기준)
// 서버 응답이 기준이다. docs/API_SPEC.md와 다르면 응답을 따른다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

// iOS 시뮬레이터는 localhost, 안드로이드 에뮬레이터는 10.0.2.2. 실제 폰은 .env.local에 PC IP를 넣는다
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

export type PropertyType = 'apartment' | 'officetel' | 'villa' | 'land';
export type DealType = 'sale' | 'jeonse' | 'monthly';
export type Level = 'sigungu' | 'dong' | 'complex';

// 지역 마커에는 level이 없다 (최상위 data.level만 있음)
export type RegionMarker = {
  kind: 'region';
  region_code: string;
  name: string;
  lat: number;
  lng: number;
  transaction_count: number;
  summary: {
    median_price_per_pyeong?: number | null;
    median_deposit_per_pyeong?: number | null;
    median_deposit?: number | null;
    median_monthly_rent?: number | null;
  };
};

// 단지 마커에는 property_type이 없다
export type ComplexMarker = {
  kind: 'complex';
  complex_id?: string;
  id?: string;
  name: string;
  lat: number;
  lng: number;
  transaction_count: number;
  latest: {
    deal_type: DealType;
    price: number | null;
    deposit: number | null;
    monthly_rent: number | null;
    exclusive_area_pyeong: number | null;
    supply_area_pyeong: number | null; // 실데이터에서는 항상 null
    floor: number | null;
    contract_date: string;
  };
};

// 실데이터는 지번이 가려져 있어 필지 마커가 나오지 않는다. 샘플 모드용
export type ParcelMarker = {
  kind: 'parcel';
  transaction_id: string;
  pnu: string | null;
  lat: number;
  lng: number;
  latest: { deal_type: DealType; price: number | null; land_area_pyeong: number | null; contract_date: string };
};

export type MapMarker = RegionMarker | ComplexMarker | ParcelMarker;

export type MarkersResult = {
  level: Level;
  markers: MapMarker[];
  meta: { data_as_of?: string; reporting_lag_notice?: boolean };
  dataMode: string | null; // X-Data-Mode: real | sample
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// X-Device-Id: 설치 후 처음 한 번 만들어 저장하고 계속 쓴다
const DEVICE_ID_KEY = 'pugurin.device_id';
let deviceIdPromise: Promise<string> | null = null;

export function getDeviceId(): Promise<string> {
  deviceIdPromise ??= (async () => {
    const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (saved) return saved;
    const id = randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  })();
  return deviceIdPromise;
}

// MapLibre 줌은 512px 타일 기준이라 표준 웹 메르카토르 줌보다 1 작다
export const toServerZoom = (mapLibreZoom: number) => Math.floor(mapLibreZoom + 1);

export async function fetchMarkers(
  params: {
    bbox: [number, number, number, number]; // min_lng, min_lat, max_lng, max_lat
    mapLibreZoom: number;
    propertyType: PropertyType;
    dealType?: DealType;
    periodMonths?: number;
  },
  signal?: AbortSignal,
): Promise<MarkersResult> {
  const q = new URLSearchParams({
    bbox: params.bbox.map((v) => v.toFixed(6)).join(','),
    zoom: String(toServerZoom(params.mapLibreZoom)),
    property_type: params.propertyType,
    deal_type: params.dealType ?? 'sale',
    period_months: String(params.periodMonths ?? 12),
  });
  const res = await fetch(`${API_BASE}/api/v1/map/markers?${q}`, {
    headers: { 'X-Device-Id': await getDeviceId() },
    signal,
  });
  const body = await res.json();
  if (!res.ok) {
    const e = body?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'UNKNOWN', e.message ?? `HTTP ${res.status}`);
  }
  return {
    level: body.data.level,
    markers: body.data.markers,
    meta: body.meta ?? {},
    dataMode: res.headers.get('X-Data-Mode'),
  };
}

// 1450000000 → "14.5억", 85000000 → "8,500만"
export function formatWon(won: number | null | undefined): string {
  if (won == null) return '-';
  if (won >= 1e8) return `${(won / 1e8).toFixed(1).replace(/\.0$/, '')}억`;
  return `${Math.round(won / 1e4).toLocaleString('ko-KR')}만`;
}

// 마커 라벨 (심볼 레이어 text-field용 두 줄)
export function markerLabel(m: MapMarker): string {
  if (m.kind === 'region') {
    const s = m.summary;
    const v =
      s.median_price_per_pyeong != null ? `평당 ${formatWon(s.median_price_per_pyeong)}`
      : s.median_deposit_per_pyeong != null ? `평당 ${formatWon(s.median_deposit_per_pyeong)}`
      : s.median_deposit != null ? `${formatWon(s.median_deposit)}/${formatWon(s.median_monthly_rent)}`
      : `${m.transaction_count}건`;
    return `${m.name}\n${v}`;
  }
  if (m.kind === 'complex') {
    const l = m.latest;
    const price = l.deal_type === 'monthly' ? `${formatWon(l.deposit)}/${formatWon(l.monthly_rent)}` : formatWon(l.price ?? l.deposit);
    // 공급 평형이 없으면 "전용 25.7평"
    const area = l.supply_area_pyeong != null ? `${l.supply_area_pyeong}평` : l.exclusive_area_pyeong != null ? `전용 ${l.exclusive_area_pyeong}평` : '';
    return `${price}\n${area}`;
  }
  return `${formatWon(m.latest.price)}\n${m.latest.land_area_pyeong != null ? `${m.latest.land_area_pyeong}평` : ''}`;
}

export const markerId = (m: MapMarker) =>
  m.kind === 'region' ? `r-${m.region_code}` : m.kind === 'complex' ? `c-${m.complex_id ?? m.id}` : `p-${m.transaction_id}`;
