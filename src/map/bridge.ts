// 지도 컴포넌트(웹·앱)와 카카오 런타임 사이의 메시지 변환
import { markerHover } from "./hover";
import { markerItems } from "./markers";
import { selectionFeatures } from "./selection";
import { userLocationFeatures } from "./userLocation";
import type { MapEvent, MapProps } from "./types";

export type RuntimeMessage =
  | MapEvent
  | { type: "boot" }
  | { type: "hover"; id: string | null; x?: number; y?: number };

// 런타임에 보내는 지도 상태. 바뀐 부분만 보내도 되도록 묶음별로 나눈다
export const markerState = (p: MapProps) => ({
  type: "state" as const,
  items: markerItems(p.markers, p.property, p.unit, p.selected),
});
export const layerState = (p: MapProps) => ({
  type: "state" as const,
  base: p.base,
  cadastral: p.cadastral,
});
export const shapeState = (p: MapProps) => ({
  type: "state" as const,
  selection: selectionFeatures(p.selectionPoint, p.parcelGeometry),
  user: userLocationFeatures(p.userLocation),
});
export const fullState = (p: MapProps) => ({
  ...markerState(p),
  ...layerState(p),
  ...shapeState(p),
});

// 런타임 메시지를 MapProps 콜백으로 넘긴다. boot는 각 컴포넌트가 따로 처리한다
export function handleRuntimeMessage(m: RuntimeMessage, p: MapProps) {
  if (m.type === "boot") return;
  if (m.type === "hover") {
    if (!p.onMarkerHover) return;
    const finePointer =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: fine)").matches ?? false);
    const width = typeof window !== "undefined" ? window.innerWidth : 0;
    const marker = m.id
      ? markerHover(p.markers, [{ properties: { id: m.id } }], width, finePointer)
      : null;
    p.onMarkerHover(
      marker,
      marker && m.x != null && m.y != null ? { x: m.x, y: m.y } : undefined,
    );
    return;
  }
  p.onEvent(m);
}
