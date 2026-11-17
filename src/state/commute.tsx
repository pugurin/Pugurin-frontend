import React, { createContext, useContext } from "react";
import type { SearchResult } from "../api/types";
import type { TransitLeg, TransitMode, TransitUnavailable } from "../api/transit";

// 길찾기의 출발·도착 한 곳. 집은 단지, 직장은 검색으로 고른 곳
export type Place = { name: string; address?: string; lat: number; lng: number };

export function placeFromSearch(r: SearchResult): Place {
  return {
    name: r.name ?? r.address ?? "고른 위치",
    address: r.name ? r.address : undefined,
    lat: r.lat,
    lng: r.lng,
  };
}

// 앱(App)이 직장 값과 화면 전환을 내려준다. 공급자가 없으면(테스트 등) 출퇴근 칸을 숨긴다
export type CommuteApi = {
  workplace: Place | null;
  // 직장을 고르고, home이 있으면 고른 뒤 그 집에서 길찾기를 연다
  pickWorkplace: (home?: Place) => void;
  openRoute: (home: Place) => void;
};
const CommuteContext = createContext<CommuteApi | null>(null);
export const CommuteProvider = CommuteContext.Provider;
export const useCommute = () => useContext(CommuteContext);

// 65 → "1시간 5분"
export function minutesLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
}

export const MODE_COLOR: Record<TransitMode, string> = {
  walk: "#B8B8B0",
  bus: "#3B82F6",
  subway: "#22A447",
  etc: "#7B5A9E",
};
export const MODE_LABEL: Record<TransitMode, string> = {
  walk: "도보",
  bus: "버스",
  subway: "지하철",
  etc: "기타",
};
export const legColor = (l: TransitLeg) => l.line?.color ?? MODE_COLOR[l.mode];

// 구간 한 줄 설명. "부산 2호선 · 해운대역 → 서면역 (15개 역)"
export function legText(l: TransitLeg) {
  if (l.mode === "walk")
    return `걷기 ${l.distance_m.toLocaleString()}m${l.end_name ? ` · ${l.end_name}까지` : ""}`;
  const stops = l.stop_count
    ? ` (${l.stop_count}개 ${l.mode === "subway" ? "역" : "정류장"})`
    : "";
  const span =
    l.start_name && l.end_name ? ` · ${l.start_name} → ${l.end_name}` : "";
  return `${l.line?.name ?? MODE_LABEL[l.mode]}${span}${stops}`;
}

export const UNAVAILABLE_TEXT: Record<TransitUnavailable, string> = {
  too_close: "집과 직장이 700m 안이라 걸어가는 게 빨라요",
  no_route: "대중교통으로 가는 경로를 찾지 못했어요",
  source_unavailable: "길찾기 정보를 잠시 불러올 수 없어요. 잠시 뒤 다시 시도해 주세요",
};
