// 지도 마커 글자·색. 카카오 지도 런타임(kakaoRuntime.ts)에는 여기서 만든 MarkerItem만 넘긴다
import type { Marker, Property } from "../api/types";
import { markerId } from "../state/market";
import type { MapProps } from "./types";

export const MARKER_COLOR: Record<Property, string> = {
  apartment: "#3E64A0",
  officetel: "#7B5A9E",
  villa: "#B0506B",
  land: "#4F7A3A",
};
export const SELECTED_COLOR = "#111110";

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
