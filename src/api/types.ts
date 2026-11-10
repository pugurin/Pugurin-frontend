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
  // 경매·공매·학교 응답의 출처. 화면에 표시해야 한다(학교는 여러 곳이라 배열)
  source_attribution?: string | string[];
  source_url?: string;
  // 학교 응답의 안내 문구(직선거리 기준이며 학군이 아님)
  school_notice?: string;
  // 배정 초등학교 안내 문구(학구도는 참고용이며 실제 배정은 교육청 확인)
  assignment_notice?: string;
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
// 학교급. 백엔드 SchoolOut.level과 같다
export type SchoolLevel =
  "elementary" | "middle" | "high" | "special" | "other";
export type School = {
  id: string;
  name: string;
  kind: string | null;
  level: SchoolLevel;
  foundation: string | null;
  coed: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  tel: string | null;
  homepage: string | null;
  opened_on: string | null;
  distance_m: number | null;
};
// 병원 종별. 백엔드 HospitalOut.tier와 같다
export type HospitalTier =
  | "general"
  | "hospital"
  | "clinic"
  | "dental"
  | "oriental"
  | "public"
  | "other";
export type Hospital = {
  id: string;
  name: string;
  class_name: string | null;
  tier: HospitalTier;
  address: string;
  lat: number | null;
  lng: number | null;
  tel: string | null;
  homepage: string | null;
  doctors: number | null;
  distance_m: number | null;
};
// 초등학교 통학구역(학구도) 경계(`/schools/{id}/zone`). geometry는 WGS84 GeoJSON이다
export type SchoolZone = {
  school_id: string;
  kind: string;
  geometry: import("geojson").Polygon | import("geojson").MultiPolygon;
};
// 단지 주변 학교 요약(`/complexes/{id}/nearby`). 학교급별 반경 안 가까운 순 최대 3곳이다
// 병원 요약도 같이 오지만 화면에서 쓰지 않아 타입에 넣지 않는다
export type NearbySchools = {
  radius_m: number;
  // 학구도(통학구역) 기준 배정 초등학교. 서버가 학구도를 아직 싣지 않았으면 키가 없고,
  // 통학구역 밖이면 null이다
  assigned_elementary?: School | null;
  elementary: School[];
  middle: School[];
  high: School[];
};
export type Nearby = { schools: NearbySchools };
export type AuctionSource = "court" | "public";
export type AuctionGroup =
  "apartment" | "officetel" | "villa" | "land" | "other";
export type Auction = {
  id: string;
  source: AuctionSource;
  case_no: string;
  court_name: string | null;
  title: string | null;
  usage: string | null;
  property_group: AuctionGroup;
  address: string;
  lat: number | null;
  lng: number | null;
  location_precise: boolean;
  complex_id: string | null;
  appraisal_price: number | null;
  min_price: number | null;
  min_price_ratio: number | null;
  deposit: number | null;
  fail_count: number | null;
  sale_date: string | null;
  bid_start_at: string | null;
  bid_end_at: string | null;
  land_area_m2: number | null;
  land_area_pyeong: number | null;
  building_area_m2: number | null;
  building_area_pyeong: number | null;
  is_share: boolean;
  status: string | null;
  is_closed: boolean;
  // 백엔드 추가 예정. 없을 수 있다
  recent_trade_price?: number | null;
  recent_trade_date?: string | null;
  recent_trade_area_m2?: number | null;
  recent_trade_count?: number | null;
};
export type AuctionSchedule = {
  date: string | null;
  kind: string | null;
  min_price: number | null;
  result: string | null;
  sale_price: number | null;
};
export type AuctionResult = {
  date: string | null;
  result: string | null;
  bidders: number | null;
  top_price: number | null;
};
export type AuctionDetail = Auction & {
  schedule: AuctionSchedule[];
  results: AuctionResult[];
};
export type AuctionQuery = {
  bbox?: BBox;
  complexId?: string;
  source?: AuctionSource;
  groups?: AuctionGroup[];
  includeClosed?: boolean;
  page?: number;
  pageSize?: number;
  sort?:
    "sale_date" | "min_price_ratio" | "min_price" | "recent_trade_discount";
  excludeShare?: boolean;
};
