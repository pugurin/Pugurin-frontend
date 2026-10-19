// 미리보기는 화면에 이미 받은 마커만 사용한다. 포인터 이동으로 추가 조회하지 않는다.
import type { Marker } from "../api/types";
import { markerId } from "../state/market";
import { MARKER_DOT_LAYER, MARKER_LABEL_LAYER } from "./style";
export const hoverLayers = (exists: (id: string) => boolean) =>
  [MARKER_LABEL_LAYER.id, MARKER_DOT_LAYER.id].filter(exists);
export function markerHover(
  markers: Marker[],
  hits: ReadonlyArray<{ properties?: { id?: unknown } | null }>,
  width: number,
  finePointer: boolean,
): Marker | null {
  if (width < 1024 || !finePointer) return null;
  for (const hit of hits) {
    const id = hit.properties?.id;
    if (id == null) continue;
    const marker = markers.find((item) => markerId(item) === String(id));
    if (marker) return marker;
  }
  return null;
}
