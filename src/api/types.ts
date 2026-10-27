export type Property = "apartment" | "officetel" | "villa" | "land";
export type Deal = "sale" | "jeonse" | "monthly";
export type BBox = [number, number, number, number];
export type Sort = "contract_date_desc" | "price_asc" | "price_desc";
export type Filters = {
  property_type: Property;
  deal_type: Deal;
  period_months: number;
  exclude_direct: boolean;
  // 전세·월세 갱신 계약 포함 (서버 기본은 신규 계약만). 켰을 때만 true로 둔다
  include_renewals?: boolean;
  price_min?: number;
  price_max?: number;
  deposit_min?: number;
  deposit_max?: number;
  rent_min?: number;
  rent_max?: number;
  exclusive_area_pyeong_min?: number;
  exclusive_area_pyeong_max?: number;
  land_area_pyeong_min?: number;
  land_area_pyeong_max?: number;
};
export type UnavailableReason =
  | "no_parcel"
  | "out_of_service_area"
  | "source_unavailable";
export type Meta = {
  data_as_of?: string;
  // 토지 조회(/parcels/*)에서 정보를 줄 수 없는 이유
  unavailable_reason?: UnavailableReason | null;
  reporting_lag_notice?: boolean;
  page?: number;
  page_size?: number;
  total?: number;
  total_pages?: number;
  data_mode?: string;
  method?: string;
};
export type Envelope<T> = { data: T; meta?: Meta };
export type Latest = {
  deal_type: Deal;
  price: number | null;
  deposit?: number | null;
  monthly_rent?: number | null;
  exclusive_area_pyeong?: number | null;
  supply_area_pyeong?: number | null;
  land_area_pyeong?: number | null;
  floor?: number | null;
  contract_date: string;
};
export type RegionMarker = {
  kind: "region";
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
export type ComplexMarker = {
  kind: "complex";
  complex_id: string;
  name: string;
  lat: number;
  lng: number;
  transaction_count: number;
  latest: Latest;
};
export type ParcelMarker = {
  kind: "parcel";
  transaction_id: string;
  pnu: string;
  lat: number;
  lng: number;
  latest: Latest;
};
export type Marker = RegionMarker | ComplexMarker | ParcelMarker;
export type MarkerData = {
  level: "sigungu" | "dong" | "complex";
  markers: Marker[];
};
export type Area = {
  exclusive_area_m2: number;
  exclusive_area_pyeong: number;
  supply_area_pyeong: number | null;
};
export type Complex = {
  id: string;
  property_type: Property;
  name: string;
  address: string;
  region_code: string;
  pnu: string | null;
  lat: number;
  lng: number;
  build_year: number | null;
  household_count: number | null;
  area_types: Area[];
};
export type Transaction = Latest & {
  id: string;
  property_type: Property;
  complex_id: string | null;
  // 단지 거래면 단지명. 단지가 아닌 거래(빌라·토지 등)는 null이라 주소를 대신 보여준다
  complex_name?: string | null;
  address: string;
  region_code: string;
  lat: number;
  lng: number;
  exclusive_area_m2: number | null;
  price_per_pyeong: number | null;
  trade_method: "broker" | "direct" | null;
  is_cancelled: boolean;
  cancelled_at: string | null;
  // 전세·월세 갱신 계약. 매매는 항상 false
  is_renewal?: boolean;
};
export type Term = {
  id: string;
  term: string;
  category: "trade" | "land" | "building" | "tax";
  is_popular: boolean;
  display_order: number;
  short_definition: string;
  long_definition: string;
  example: string;
};
export type SearchResult = {
  type: "complex" | "region" | "address";
  name?: string;
  address?: string;
  complex_id?: string;
  region_code?: string;
  region_level?: "sigungu" | "dong";
  pnu?: string;
  lat: number;
  lng: number;
  bbox?: BBox;
};
export type Metrics = {
  median_price_per_pyeong?: number | null;
  median_deposit_per_pyeong?: number | null;
  median_deposit?: number | null;
  median_monthly_rent?: number | null;
};
export type Trend = Metrics & { month: string; count: number };
export type Stats = Metrics & {
  transaction_count: number;
  trend: Trend[];
  area_types?: (Area &
    Metrics & { transaction_count: number; trend: Trend[] })[];
};
export type Analysis = {
  region?: { region_code: string; name: string };
  complex_stats?: Stats;
  region_stats?: Stats;
  comparison?: { summary: string; difference_percent: number } | null;
  zonings: NonNullable<Parcel["zonings"]> | null;
  disclaimer?: string;
};

// 토지 조회 결과 (/parcels/*). 공급처가 응답한 값만 화면에 사용한다
export type Parcel = {
  pnu: string;
  jibun_address: string;
  land_category?: string | null;
  land_area_pyeong?: number | null;
  land_area_m2?: number | null;
  official_land_price_per_m2?: number | null;
  official_land_price_year?: number | null;
  road_side?: string | null;
  shape?: string | null;
  geometry?: Record<string, unknown> | null;
  zonings?:
    | {
        zone_type: string;
        area_ratio: number | null;
        inclusion: string;
        max_building_coverage_ratio: number | null;
        max_floor_area_ratio: number | null;
      }[]
    | null;
  ratio_source?: string | null;
  restrictions?:
    | {
        name: string;
        plain_explanation: string;
        glossary_term_id: string | null;
      }[]
    | null;
  glossary?: Record<string, string>;
};
