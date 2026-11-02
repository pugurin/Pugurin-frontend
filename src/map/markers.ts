// 지도 마커 글자·색. 카카오 지도 런타임(kakaoRuntime.ts)에는 여기서 만든 MarkerItem만 넘긴다
import type { Auction, Marker, Property } from "../api/types";
import { auctionAmount, auctionSub } from "../state/auction";
import { formatPrice, markerId } from "../state/market";
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
          : "보증금 " + man(s.median_deposit) + " · 월 " + man(s.median_monthly_rent);
    return { title: m.name, amount, sub: m.transaction_count.toLocaleString("ko-KR") + "건" };
  }
  const l = m.latest;
  const amount =
    l.deal_type === "sale"
      ? price(l.price)
      : l.deal_type === "jeonse"
        ? "전세 " + price(l.deposit)
        : man(l.deposit) + "/" + man(l.monthly_rent);
  const area = l.land_area_pyeong ?? l.supply_area_pyeong ?? l.exclusive_area_pyeong;
  const prefix = l.supply_area_pyeong == null && l.land_area_pyeong == null ? "전용 " : "";
  const value = area == null ? "—" : unit === "㎡" ? (area * 3.3058).toFixed(1) : String(area);
  return {
    title: "",
    amount,
    sub: `${prefix}${value}${unit} · '${l.contract_date.slice(2, 7).replace("-", ".")}`,
  };
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
  // 옆에 붙을 단지 마커 id. 그 단지가 점이 아니게 그려졌을 때만 옆에 놓는다
  attach?: string;
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
// 같은 단지 여러 건은 하나("auction-group:{complex_id}")로 합친다. 단지 마커가 있으면 그 옆에 붙이고,
// 없으면(경매 탭이나 거래 없는 단지) 첫 물건 좌표에 둔다
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
  const groups = new Map<string, { lat: number; lng: number; members: Auction[] }>();
  placed.forEach(({ a, lat, lng }) => {
    if (!a.complex_id) return;
    const g = groups.get(a.complex_id);
    if (g) g.members.push(a);
    else groups.set(a.complex_id, { lat, lng, members: [a] });
  });
  const done = new Set<string>();
  const items: MarkerItem[] = [];
  placed.forEach(({ a, lat, lng }) => {
    const attach = a.complex_id && complexes.has(a.complex_id) ? a.complex_id : undefined;
    const group = a.complex_id ? groups.get(a.complex_id)!.members : [a];
    const base = { region: false, title: "", auction: true } as const;
    if (group.length > 1 && a.complex_id) {
      const cid = a.complex_id;
      if (done.has(cid)) return;
      done.add(cid);
      const at = attach ? complexes.get(attach)! : groups.get(cid)!;
      const id = `auction-group:${cid}`;
      const isSelected = id === selected;
      const prices = group.flatMap((m) => (m.min_price == null ? [] : [m.min_price]));
      items.push({
        ...base,
        id,
        lat: at.lat,
        lng: at.lng,
        amount: `⚖ ${group.length}건`,
        sub: prices.length ? `최저 ${formatPrice(Math.min(...prices))}` : "최저가 미정",
        color: isSelected ? SELECTED_COLOR : AUCTION_COLOR,
        rank: isSelected ? 0 : 3,
        ...(attach ? { attach } : {}),
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
      ...(attach ? { attach } : {}),
    });
  });
  // 서버가 준 순서(매각기일 가까운 순)대로 먼저 자리를 잡게 한다. 실거래(2~3) 뒤, 선택은 0
  return items.map((m, k) =>
    m.rank === 0 ? m : { ...m, rank: 3 + (k + 1) / (items.length + 1) },
  );
}
