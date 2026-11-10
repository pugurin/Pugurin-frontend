// 지도 마커 글자·색. 카카오 지도 런타임(kakaoRuntime.ts)에는 여기서 만든 MarkerItem만 넘긴다
import type {
  Auction,
  ComplexMarker,
  Marker,
  Property,
  School,
  SchoolLevel,
  TypicalArea,
} from "../api/types";
import { auctionAmount, auctionSub } from "../state/auction";
import { formatPrice, markerId, pyeongType } from "../state/market";
import {
  SCHOOL_LEVEL,
  schoolShortName,
  type SchoolShape,
} from "../state/school";
import type { MapProps } from "./types";

export const MARKER_COLOR: Record<Property, string> = {
  apartment: "#3E64A0",
  officetel: "#7B5A9E",
  villa: "#B0506B",
  land: "#4F7A3A",
};
export const SELECTED_COLOR = "#111110";
export const AUCTION_COLOR = "#B02A22";

function price(v?: number | null) {
  if (v == null) return "정보 없음";
  return v >= 1e8
    ? (v / 1e8).toFixed(1).replace(/\.0$/, "") + "억"
    : Math.round(v / 1e4).toLocaleString("ko-KR") + "만";
}
const man = (v?: number | null) =>
  v == null ? "—" : Math.round(v / 1e4).toLocaleString("ko-KR");

// 마커 글자 (디자인 W3 표기). region: 지역명 / 대표값 / 건수, 그 외: 금액 / 면적 · 계약월
export function markerLines(m: Marker, unit: MapProps["unit"]) {
  if (m.kind === "region") {
    const s = m.summary;
    const amount =
      s.median_price_per_pyeong != null
        ? "평당 " + price(s.median_price_per_pyeong)
        : s.median_deposit_per_pyeong != null
          ? "평당 보증금 " + price(s.median_deposit_per_pyeong)
          : "보증금 " +
            man(s.median_deposit) +
            " · 월 " +
            man(s.median_monthly_rent);
    return {
      title: m.name,
      amount,
      sub: m.transaction_count.toLocaleString("ko-KR") + "건",
    };
  }
  const typical = m.kind === "complex" ? typicalLines(m, unit) : null;
  if (typical) return typical;
  const l = m.latest;
  const amount =
    l.deal_type === "sale"
      ? price(l.price)
      : l.deal_type === "jeonse"
        ? "전세 " + price(l.deposit)
        : man(l.deposit) + "/" + man(l.monthly_rent);
  const area =
    l.land_area_pyeong ?? l.supply_area_pyeong ?? l.exclusive_area_pyeong;
  const prefix =
    l.supply_area_pyeong == null && l.land_area_pyeong == null ? "전용 " : "";
  const value =
    area == null
      ? "—"
      : unit === "㎡"
        ? (area * 3.3058).toFixed(1)
        : String(area);
  return {
    title: "",
    amount,
    sub: `${prefix}${value}${unit} · '${l.contract_date.slice(2, 7).replace("-", ".")}`,
  };
}

// 단지 마커의 대표 평형(거래가 가장 많은 평형) 평균가. 서버가 안 보냈거나 맞는 평균값이 없으면 null
function typicalLines(m: ComplexMarker, unit: MapProps["unit"]) {
  const t = m.typical;
  if (!t) return null;
  const deal = m.latest.deal_type;
  const amount =
    deal === "sale"
      ? t.avg_price != null && price(t.avg_price)
      : deal === "jeonse"
        ? t.avg_deposit != null && "전세 " + price(t.avg_deposit)
        : t.avg_deposit != null &&
          t.avg_monthly_rent != null &&
          man(t.avg_deposit) + "/" + man(t.avg_monthly_rent);
  if (!amount) return null;
  return { title: "", amount, sub: typicalArea(t, unit) };
}

// 공급 평형이 있으면 "34평형"(㎡면 "112㎡형"), 없으면 최근 거래 표기처럼 "전용 25.7평"(㎡면 "전용 85.0㎡").
// "전용"을 붙여 공급 평형(25평형)과 헷갈리지 않게 한다
function typicalArea(t: TypicalArea, unit: MapProps["unit"]) {
  if (t.supply_area_pyeong != null) {
    return unit === "㎡"
      ? Math.round(t.supply_area_pyeong * 3.3058) + "㎡형"
      : pyeongType(t.supply_area_pyeong);
  }
  return unit === "㎡"
    ? `전용 ${t.exclusive_area_m2.toFixed(1)}㎡`
    : `전용 ${t.exclusive_area_pyeong}평`;
}

export type MarkerItem = {
  id: string;
  lat: number;
  lng: number;
  region: boolean;
  title: string;
  amount: string;
  sub: string;
  color: string;
  // 작을수록 먼저 자리를 잡는다. 선택 > 구·동 > 거래 건수 순 (겹치면 뒤의 것이 점으로)
  rank: number;
  // 경매 마커는 흰 바탕 변형으로 그린다
  auction?: boolean;
  // 배지로 붙을 단지 마커 id. 그 단지가 점이 아니게 그려졌을 때만 단지 마커 모서리에 tag 배지로 붙고,
  // 단지가 점이면 그리지 않는다
  attach?: string;
  // 단지 마커 모서리에 붙일 경매 배지 글자 (예: "⚖2")
  tag?: string;
  // 학교 마커의 학교급. 꼬리 없는 흰 칸에 도형 배지와 줄인 이름으로 그린다
  school?: SchoolLevel;
  // 학교 도형 안 글자와 도형 모양. 런타임 문자열은 SCHOOL_LEVEL을 import할 수 없어 항목에 실어 보낸다
  badge?: string;
  shape?: SchoolShape;
};

export function markerItems(
  markers: Marker[],
  property: Property,
  unit: MapProps["unit"],
  selected: string | null,
): MarkerItem[] {
  return markers.map((m) => {
    const id = markerId(m);
    const isSelected = id === selected;
    const count = "transaction_count" in m ? m.transaction_count : 0;
    return {
      id,
      lat: m.lat,
      lng: m.lng,
      region: m.kind === "region",
      ...markerLines(m, unit),
      color: isSelected ? SELECTED_COLOR : MARKER_COLOR[property],
      rank: isSelected ? 0 : m.kind === "region" ? 1 : 2 + 1 / (1 + count),
    };
  });
}

// 경매 마커. 좌표 없는 물건은 지도에 그리지 않는다.
// 같은 단지 여러 건은 하나("auction-group:{complex_id}")로 합친다. 단지 마커가 있으면 그 단지 마커에
// 배지로 붙이고, 없으면(경매 탭이나 거래 없는 단지) 첫 물건 좌표에 경매 마커로 둔다
export function auctionItems(
  auctions: Auction[],
  markers: Marker[],
  selected: string | null,
  today: Date,
): MarkerItem[] {
  const complexes = new Map<string, Marker>();
  markers.forEach((m) => {
    if (m.kind === "complex") complexes.set(markerId(m), m);
  });
  const placed = auctions.flatMap((a) =>
    a.lat == null || a.lng == null ? [] : [{ a, lat: a.lat, lng: a.lng }],
  );
  // 단지별 물건 목록. 첫 물건 좌표는 단지 마커가 없을 때 묶음 자리로 쓴다
  const groups = new Map<
    string,
    { lat: number; lng: number; members: Auction[] }
  >();
  placed.forEach(({ a, lat, lng }) => {
    if (!a.complex_id) return;
    const g = groups.get(a.complex_id);
    if (g) g.members.push(a);
    else groups.set(a.complex_id, { lat, lng, members: [a] });
  });
  const done = new Set<string>();
  const items: MarkerItem[] = [];
  placed.forEach(({ a, lat, lng }) => {
    const attach =
      a.complex_id && complexes.has(a.complex_id) ? a.complex_id : undefined;
    const group = a.complex_id ? groups.get(a.complex_id)!.members : [a];
    const base = { region: false, title: "", auction: true } as const;
    if (group.length > 1 && a.complex_id) {
      const cid = a.complex_id;
      if (done.has(cid)) return;
      done.add(cid);
      const at = attach ? complexes.get(attach)! : groups.get(cid)!;
      const id = `auction-group:${cid}`;
      const isSelected = id === selected;
      const prices = group.flatMap((m) =>
        m.min_price == null ? [] : [m.min_price],
      );
      items.push({
        ...base,
        id,
        lat: at.lat,
        lng: at.lng,
        amount: `⚖ ${group.length}건`,
        sub: prices.length
          ? `최저 ${formatPrice(Math.min(...prices))}`
          : "최저가 미정",
        color: isSelected ? SELECTED_COLOR : AUCTION_COLOR,
        rank: isSelected ? 0 : 3,
        ...(attach ? { attach, tag: `⚖${group.length}` } : {}),
      });
      return;
    }
    const id = `auction:${a.id}`;
    const isSelected = id === selected;
    items.push({
      ...base,
      id,
      lat,
      lng,
      amount: auctionAmount(a),
      sub: auctionSub(a, today),
      color: isSelected ? SELECTED_COLOR : AUCTION_COLOR,
      rank: isSelected ? 0 : 3,
      ...(attach ? { attach, tag: "⚖1" } : {}),
    });
  });
  // 서버가 준 순서(매각기일 가까운 순)대로 먼저 자리를 잡게 한다. 실거래(2~3) 뒤, 선택은 0
  return items.map((m, k) =>
    m.rank === 0 ? m : { ...m, rank: 3 + (k + 1) / (items.length + 1) },
  );
}

// 학교 마커. 좌표 없는 학교는 지도에 그리지 않는다.
// 선택해도 색은 학교급 색 그대로 두고 rank만 0으로 올린다. 런타임은 학교를 경매보다도 뒤에 자리 잡게 한다
export function schoolItems(
  schools: School[],
  selected: string | null,
): MarkerItem[] {
  return schools.flatMap((s) => {
    if (s.lat == null || s.lng == null) return [];
    const id = `school:${s.id}`;
    const level = SCHOOL_LEVEL[s.level];
    return [
      {
        id,
        lat: s.lat,
        lng: s.lng,
        region: false,
        title: "",
        amount: schoolShortName(s.name),
        sub: "",
        color: level.color,
        rank: id === selected ? 0 : level.rank,
        school: s.level,
        badge: level.badge,
        shape: level.shape,
      },
    ];
  });
}
