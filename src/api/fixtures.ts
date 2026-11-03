import type {
  Complex,
  Transaction,
  Trend,
  Stats,
  Filters,
  MarkerData,
  BBox,
  SearchResult,
  Envelope,
  Sort,
  AuctionDetail,
  Meta,
  School,
  Hospital,
} from "./types";
import { TERMS } from "./terms";
export { TERMS };
export const SAMPLE_META = {
  data_as_of: "2026-10-05T04:00:00+09:00",
  reporting_lag_notice: true,
  data_mode: "sample",
};
const rows: [string, number, number, number, number | null, number, string][] =
  [
    ["해운대아이파크", 35.1565, 129.1435, 14.5, 34, 21, "우동"],
    ["해운대두산위브더제니스", 35.1578, 129.1459, 12.8, 41, 33, "우동"],
    ["경동제이드", 35.1631, 129.1538, 8.2, null, 7, "우동"],
    ["우동현대", 35.1704, 129.1447, 4.3, 32, 5, "우동"],
    ["마린시티자이", 35.1617, 129.1407, 9.9, 33, 12, "우동"],
    ["해운대센텀두산위브", 35.1772, 129.1284, 7.4, 35, 8, "우동"],
    ["엘시티더샵", 35.16, 129.17, 19.4, 61, 32, "중동"],
    ["해운대힐스테이트", 35.168, 129.166, 9.6, 33, 14, "중동"],
  ];
export const COMPLEXES: Complex[] = rows.map((r, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  property_type: "apartment",
  name: r[0],
  lat: r[1],
  lng: r[2],
  address: `부산광역시 해운대구 ${r[6]} ${1407 + i}`,
  region_code: r[6] === "우동" ? "2635010500" : "2635010600",
  pnu: null,
  build_year: 2011 + i,
  household_count: i === 0 ? 1631 : 742 + i * 137,
  area_types: [
    {
      exclusive_area_m2: 84.97,
      exclusive_area_pyeong: 25.7,
      supply_area_pyeong: r[4],
    },
    {
      exclusive_area_m2: 112.4,
      exclusive_area_pyeong: 34,
      supply_area_pyeong: 45,
    },
    {
      exclusive_area_m2: 143.5,
      exclusive_area_pyeong: 43.4,
      supply_area_pyeong: 58,
    },
  ],
}));
export const TRANSACTIONS: Transaction[] = COMPLEXES.flatMap((c, i) =>
  Array.from({ length: 24 }, (_, j) => ({
    id: `tx-${i}-${j}`,
    complex_id: c.id,
    complex_name: c.name,
    property_type: c.property_type,
    address: c.address,
    region_code: c.region_code,
    lat: c.lat,
    lng: c.lng,
    deal_type: (["sale", "jeonse", "monthly"] as const)[j % 3],
    price: j % 3 === 0 ? Math.round((rows[i][3] - j * 0.018) * 1e8) : null,
    deposit: j % 3 === 1 ? 500000000 : j % 3 === 2 ? 50000000 : null,
    monthly_rent: j % 3 === 2 ? 800000 : null,
    exclusive_area_m2: j % 4 === 0 ? 84.97 : 112.4,
    exclusive_area_pyeong: j % 4 === 0 ? 25.7 : 34,
    supply_area_pyeong: j % 4 === 0 ? rows[i][4] : 45,
    price_per_pyeong: j % 3 === 0 ? 56420000 : null,
    floor: rows[i][5] + (j % 5),
    contract_date: `2026-${String(9 - Math.floor(j / 3)).padStart(2, "0")}-${String(14 + (j % 14)).padStart(2, "0")}`,
    trade_method: j % 5 === 0 ? "direct" : "broker",
    is_cancelled: j === 6,
    cancelled_at: j === 6 ? "2026-09-21T10:00:00+09:00" : null,
  })),
);
export const TREND: Trend[] = Array.from({ length: 36 }, (_, i) => ({
  month: `${2023 + Math.floor((i + 10) / 12)}-${String(((i + 10) % 12) + 1).padStart(2, "0")}`,
  median_price_per_pyeong:
    i === 16 || i === 24
      ? null
      : Math.round((4200 + i * 32 + Math.sin(i * 0.75) * 180) * 1e4),
  count: i === 16 ? 2 : 8 + (i % 7),
}));
export const SAMPLE_STATS: Stats = {
  median_price_per_pyeong: 32000000,
  transaction_count: 128,
  trend: TREND,
};
function match(t: Transaction, f: Filters) {
  if (
    t.deal_type !== f.deal_type ||
    (f.exclude_direct && t.trade_method === "direct")
  )
    return false;
  const after = new Date("2026-10-05");
  after.setMonth(after.getMonth() - f.period_months);
  if (new Date(t.contract_date) < after) return false;
  const pairs: [
    number | null | undefined,
    number | undefined,
    number | undefined,
  ][] = [
    [t.price, f.price_min, f.price_max],
    [t.deposit, f.deposit_min, f.deposit_max],
    [t.monthly_rent, f.rent_min, f.rent_max],
    [
      t.exclusive_area_pyeong,
      f.exclusive_area_pyeong_min,
      f.exclusive_area_pyeong_max,
    ],
  ];
  return pairs.every(
    ([v, min, max]) =>
      (min === undefined || (v != null && v >= min)) &&
      (max === undefined || (v != null && v <= max)),
  );
}
export function sampleTransactions(
  f: Filters,
  options: {
    complexId?: string;
    region?: string;
    bbox?: BBox;
    sort?: Sort;
    cancelled?: boolean;
    page?: number;
    area?: number;
  } = {},
): Envelope<Transaction[]> {
  let items = TRANSACTIONS.filter(
    (t) =>
      match(t, f) &&
      (options.cancelled || !t.is_cancelled) &&
      (!options.complexId || t.complex_id === options.complexId) &&
      (!options.region || t.region_code.startsWith(options.region)) &&
      (!options.bbox ||
        (t.lng >= options.bbox[0] &&
          t.lat >= options.bbox[1] &&
          t.lng <= options.bbox[2] &&
          t.lat <= options.bbox[3])) &&
      (!options.area ||
        Math.abs((t.exclusive_area_m2 ?? 0) - options.area) < 1),
  );
  items = items.map((t) => ({ ...t, property_type: f.property_type }));
  items.sort((a, b) =>
    options.sort === "price_asc"
      ? (a.price ?? a.deposit ?? 0) - (b.price ?? b.deposit ?? 0)
      : options.sort === "price_desc"
        ? (b.price ?? b.deposit ?? 0) - (a.price ?? a.deposit ?? 0)
        : b.contract_date.localeCompare(a.contract_date),
  );
  const page = options.page ?? 1;
  return {
    data: items.slice((page - 1) * 20, page * 20),
    meta: {
      ...SAMPLE_META,
      page,
      page_size: 20,
      total: items.length,
      total_pages: Math.ceil(items.length / 20),
    },
  };
}
export function sampleMarkers(
  f: Filters,
  b: BBox,
  z: number,
): Envelope<MarkerData> {
  const level = z < 12 ? "sigungu" : z < 14 ? "dong" : "complex";
  const region = (name: string, code: string, lat: number, lng: number) => ({
    kind: "region" as const,
    name,
    region_code: code,
    lat,
    lng,
    transaction_count: 128,
    summary:
      f.deal_type === "sale"
        ? {
            median_price_per_pyeong:
              f.property_type === "land" ? 10200000 : 32000000,
          }
        : f.deal_type === "jeonse"
          ? { median_deposit_per_pyeong: 18000000 }
          : { median_deposit: 50000000, median_monthly_rent: 800000 },
  });
  const regions =
    level === "sigungu"
      ? [
          region("해운대구", "26350", 35.163, 129.154),
          region("수영구", "26500", 35.157, 129.112),
        ]
      : [
          region("우동", "2635010500", 35.166, 129.143),
          region("중동", "2635010600", 35.162, 129.169),
          region("좌동", "2635010700", 35.175, 129.178),
        ];
  const markers =
    level === "complex" && f.property_type !== "land"
      ? COMPLEXES.flatMap((c) => {
          const tx = sampleTransactions(f, { complexId: c.id }).data;
          if (!tx.length) return [];
          return [
            {
              kind: "complex" as const,
              complex_id: c.id,
              name: c.name,
              lat: c.lat,
              lng: c.lng,
              transaction_count: tx.length,
              latest: tx[0],
            },
          ];
        })
      : regions;
  return {
    data: {
      level,
      markers: markers.filter(
        (m) => m.lng >= b[0] && m.lng <= b[2] && m.lat >= b[1] && m.lat <= b[3],
      ),
    },
    meta: SAMPLE_META,
  };
}
export function sampleSearch(q: string): SearchResult[] {
  const regions: SearchResult[] = [
    {
      type: "region",
      name: "해운대구 우동",
      region_code: "2635010500",
      region_level: "dong",
      lat: 35.166,
      lng: 129.145,
      bbox: [129.12, 35.14, 129.165, 35.18],
    },
    {
      type: "region",
      name: "해운대구",
      region_code: "26350",
      region_level: "sigungu",
      lat: 35.17,
      lng: 129.16,
      bbox: [129.1, 35.14, 129.2, 35.21],
    },
    {
      type: "address",
      address: "부산광역시 해운대구 우동 1407",
      pnu: "2635010500114070000",
      lat: 35.1565,
      lng: 129.1435,
    },
  ];
  return [
    ...COMPLEXES.map((c) => ({
      type: "complex" as const,
      name: c.name,
      address: c.address,
      complex_id: c.id,
      lat: c.lat,
      lng: c.lng,
    })),
    ...regions,
  ]
    .filter((r) => `${r.name ?? ""} ${r.address ?? ""}`.includes(q))
    .slice(0, 30);
}
// 경매 샘플. 매각기일은 샘플 기준 시점(2026-11) 이후로 둔다
export const AUCTION_META: Meta = {
  ...SAMPLE_META,
  source_attribution: "대법원 법원경매정보",
  source_url: "https://www.courtauction.go.kr/",
};
const auctionBase = {
  court_name: null,
  title: null,
  location_precise: true,
  complex_id: null,
  deposit: null,
  bid_start_at: null,
  bid_end_at: null,
  land_area_m2: null,
  land_area_pyeong: null,
  building_area_m2: null,
  building_area_pyeong: null,
  is_share: false,
  status: "진행",
  is_closed: false,
  results: [],
};
export const AUCTIONS: AuctionDetail[] = [
  {
    ...auctionBase,
    id: "court:2026타경10234",
    source: "court",
    case_no: "2026타경10234",
    court_name: "부산지방법원",
    title: "해운대아이파크 84㎡",
    usage: "아파트",
    property_group: "apartment",
    address: COMPLEXES[0].address,
    lat: COMPLEXES[0].lat + 0.0003,
    lng: COMPLEXES[0].lng + 0.0003,
    complex_id: COMPLEXES[0].id,
    appraisal_price: 1450000000,
    min_price: 1015000000,
    min_price_ratio: 70,
    deposit: 101500000,
    fail_count: 2,
    sale_date: "2026-11-14",
    building_area_m2: 84.97,
    building_area_pyeong: 25.7,
    recent_trade_price: 1380000000,
    recent_trade_date: "2026-09-21",
    recent_trade_area_m2: 84.97,
    recent_trade_count: 6,
    schedule: [
      {
        date: "2026-08-29",
        kind: "매각기일",
        min_price: 1450000000,
        result: "유찰",
        sale_price: null,
      },
      {
        date: "2026-10-03",
        kind: "매각기일",
        min_price: 1160000000,
        result: "유찰",
        sale_price: null,
      },
      {
        date: "2026-11-14",
        kind: "매각기일",
        min_price: 1015000000,
        result: "예정",
        sale_price: null,
      },
    ],
  },
  {
    ...auctionBase,
    id: "court:2026타경20871",
    source: "court",
    case_no: "2026타경20871",
    court_name: "부산지방법원",
    title: "우동 다세대주택",
    usage: "다세대주택",
    property_group: "villa",
    address: "부산광역시 해운대구 우동 1500",
    lat: 35.1642,
    lng: 129.1521,
    location_precise: false,
    appraisal_price: 420000000,
    min_price: 294000000,
    min_price_ratio: 70,
    deposit: 29400000,
    fail_count: 1,
    sale_date: "2026-11-20",
    land_area_m2: 36.4,
    land_area_pyeong: 11,
    building_area_m2: 59.2,
    building_area_pyeong: 17.9,
    schedule: [
      {
        date: "2026-10-09",
        kind: "매각기일",
        min_price: 420000000,
        result: "유찰",
        sale_price: null,
      },
      {
        date: "2026-11-20",
        kind: "매각기일",
        min_price: 294000000,
        result: "예정",
        sale_price: null,
      },
    ],
  },
  {
    // 같은 단지(해운대아이파크) 두 번째 물건. 지도에서 묶음 마커로 보인다
    ...auctionBase,
    id: "court:2026타경31502",
    source: "court",
    case_no: "2026타경31502",
    court_name: "부산지방법원",
    title: "해운대아이파크 59㎡",
    usage: "아파트",
    property_group: "apartment",
    address: COMPLEXES[0].address,
    lat: COMPLEXES[0].lat - 0.0003,
    lng: COMPLEXES[0].lng + 0.0003,
    complex_id: COMPLEXES[0].id,
    appraisal_price: 980000000,
    min_price: 784000000,
    min_price_ratio: 80,
    deposit: 78400000,
    fail_count: 1,
    sale_date: "2026-11-27",
    building_area_m2: 59.96,
    building_area_pyeong: 18.1,
    schedule: [
      {
        date: "2026-10-23",
        kind: "매각기일",
        min_price: 980000000,
        result: "유찰",
        sale_price: null,
      },
      {
        date: "2026-11-27",
        kind: "매각기일",
        min_price: 784000000,
        result: "예정",
        sale_price: null,
      },
    ],
  },
  {
    ...auctionBase,
    id: "public:2026-0415-001",
    source: "public",
    case_no: "2026-0415-001",
    title: "중동 토지 지분",
    usage: "대지",
    property_group: "land",
    address: "부산광역시 해운대구 중동 1190",
    lat: 35.1688,
    lng: 129.1655,
    appraisal_price: 310000000,
    min_price: 248000000,
    min_price_ratio: 80,
    fail_count: 1,
    sale_date: "2026-12-03",
    bid_start_at: "2026-11-30T10:00:00+09:00",
    bid_end_at: "2026-12-03T17:00:00+09:00",
    land_area_m2: 132.2,
    land_area_pyeong: 40,
    is_share: true,
    schedule: [
      {
        date: "2026-10-29",
        kind: "입찰",
        min_price: 310000000,
        result: "유찰",
        sale_price: null,
      },
      {
        date: "2026-12-03",
        kind: "입찰",
        min_price: 248000000,
        result: "예정",
        sale_price: null,
      },
    ],
  },
];
// 학교 샘플. 우동·센텀 근처 5곳이며 거리는 서버가 계산하므로 비워 둔다
export const SCHOOL_META: Meta = {
  // 백엔드처럼 날짜시간으로 둔다
  data_as_of: "2026-11-02T14:03:11.123456+09:00",
  source_attribution: ["나이스 교육정보 개방 포털", "건강보험심사평가원"],
  school_notice: "배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다",
};
const schoolBase = {
  kind: null,
  foundation: null,
  coed: null,
  opened_on: null,
  distance_m: null,
};
export const SCHOOLS: School[] = [
  {
    ...schoolBase,
    id: "s-udong-elem",
    name: "우동초등학교",
    kind: "초등학교",
    level: "elementary",
    foundation: "공립",
    coed: "남여공학",
    address: "부산광역시 해운대구 우동 1234",
    lat: 35.1642,
    lng: 129.1421,
    tel: "051-000-0001",
    homepage: "https://udong.es.kr",
    opened_on: "1975-03-01",
  },
  {
    ...schoolBase,
    id: "s-centum-elem",
    name: "센텀초등학교",
    kind: "초등학교",
    level: "elementary",
    foundation: "공립",
    coed: "남여공학",
    address: "부산광역시 해운대구 센텀중앙로 55",
    lat: 35.1688,
    lng: 129.1318,
    tel: null,
    homepage: null,
    opened_on: "2010-03-01",
  },
  {
    ...schoolBase,
    id: "s-haeundae-mid",
    name: "해운대중학교",
    kind: "중학교",
    level: "middle",
    foundation: "공립",
    coed: "남여공학",
    address: "부산광역시 해운대구 해운대로 570",
    lat: 35.1655,
    lng: 129.1602,
    tel: "051-000-0003",
    homepage: "https://haeundae.ms.kr",
    opened_on: "1960-03-01",
  },
  {
    ...schoolBase,
    id: "s-haeundae-girls-high",
    name: "해운대여자고등학교",
    kind: "고등학교",
    level: "high",
    foundation: "사립",
    coed: "여",
    address: "부산광역시 해운대구 좌동순환로 100",
    lat: 35.1721,
    lng: 129.1569,
    tel: "051-000-0004",
    homepage: "https://haeundaegirls.hs.kr",
    opened_on: "1983-03-01",
  },
  {
    ...schoolBase,
    id: "s-haemaru-special",
    name: "해마루학교",
    kind: "특수학교",
    level: "special",
    foundation: "공립",
    coed: "남여공학",
    address: "부산광역시 해운대구 우동 567",
    lat: 35.1594,
    lng: 129.1488,
    tel: "051-000-0005",
    homepage: "https://haemaru.sc.kr",
    opened_on: "1999-03-01",
  },
];
// 병원 샘플. 서면(부산진구)·해운대 두 곳에 몇 개씩 두고 치과 하나로 tier 거름을 확인한다
export const HOSPITAL_META: Meta = {
  data_as_of: "2026-11-02T19:33:03Z",
  source_attribution: ["건강보험심사평가원"],
};
const hospitalBase = {
  homepage: null,
  distance_m: null,
};
export const HOSPITALS: Hospital[] = [
  {
    ...hospitalBase,
    id: "h-seomyeon-general",
    name: "부산서면종합병원",
    class_name: "종합병원",
    tier: "general",
    address: "부산광역시 부산진구 서면로 68",
    lat: 35.1578,
    lng: 129.0594,
    tel: "051-000-1001",
    homepage: "https://seomyeon-hospital.example.kr",
    doctors: 84,
  },
  {
    ...hospitalBase,
    id: "h-seomyeon-hospital",
    name: "서면연합병원",
    class_name: "병원",
    tier: "hospital",
    address: "부산광역시 부산진구 중앙대로 702",
    lat: 35.1573,
    lng: 129.0599,
    tel: "051-000-1002",
    doctors: 12,
  },
  {
    ...hospitalBase,
    id: "h-seomyeon-clinic",
    name: "전포내과의원",
    class_name: "의원",
    tier: "clinic",
    address: "부산광역시 부산진구 전포대로 199",
    lat: 35.1531,
    lng: 129.0647,
    tel: "051-000-1003",
    doctors: 2,
  },
  {
    ...hospitalBase,
    id: "h-seomyeon-dental",
    name: "서면바른치과의원",
    class_name: "치과의원",
    tier: "dental",
    address: "부산광역시 부산진구 가야대로 772",
    lat: 35.1592,
    lng: 129.0571,
    tel: "051-000-1004",
    doctors: 3,
  },
  {
    ...hospitalBase,
    id: "h-haeundae-general",
    name: "해운대중앙종합병원",
    class_name: "종합병원",
    tier: "general",
    address: "부산광역시 해운대구 해운대로 875",
    lat: 35.1634,
    lng: 129.1631,
    tel: "051-000-2001",
    homepage: "https://haeundae-central.example.kr",
    doctors: 61,
  },
  {
    ...hospitalBase,
    id: "h-haeundae-hospital",
    name: "센텀한마음병원",
    class_name: "병원",
    tier: "hospital",
    address: "부산광역시 해운대구 센텀중앙로 55",
    lat: 35.1692,
    lng: 129.1318,
    tel: "051-000-2002",
    doctors: 9,
  },
  {
    ...hospitalBase,
    id: "h-haeundae-clinic",
    name: "해운대바다이비인후과의원",
    class_name: "의원",
    tier: "clinic",
    address: "부산광역시 해운대구 중동 1394",
    lat: 35.1618,
    lng: 129.1687,
    tel: "051-000-2003",
    doctors: 1,
  },
];
