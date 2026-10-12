import { describe, expect, it } from "vitest";
import type { Marker } from "../src/api/types";
import { markerHover, hoverLayers } from "../src/map/hover";
import { MARKER_DOT_LAYER, MARKER_LABEL_LAYER } from "../src/map/style";
import { markerId } from "../src/state/market";
const marker: Marker = {
  kind: "region",
  region_code: "26350",
  name: "해운대구",
  lat: 35.16,
  lng: 129.16,
  transaction_count: 12,
  summary: { median_price_per_pyeong: 30000000 },
};
describe("큰 화면의 마커 미리보기", () => {
  it("실제로 표시한 마커의 데이터만 반환하고 추가 가격이나 단지를 만들지 않는다", () => {
    expect(
      markerHover(
        [marker],
        [{ properties: { id: markerId(marker), price: 999 } }],
        1024,
        true,
      ),
    ).toBe(marker);
    expect(
      markerHover([marker], [{ properties: { id: "없는 마커" } }], 1400, true),
    ).toBeNull();
  });
  it("1024px 미만이나 정밀 포인터가 없는 기기에서는 열리지 않는다", () => {
    const hits = [{ properties: { id: markerId(marker) } }];
    expect(markerHover([marker], hits, 1023, true)).toBeNull();
    expect(markerHover([marker], hits, 1400, false)).toBeNull();
  });
  it("빈 지도나 조회 후 사라진 마커에서는 미리보기를 비운다", () => {
    expect(markerHover([marker], [], 1400, true)).toBeNull();
    expect(
      markerHover([], [{ properties: { id: markerId(marker) } }], 1400, true),
    ).toBeNull();
  });
  it("지도 스타일에 존재하는 거래 마커 레이어만 조회한다", () => {
    expect(hoverLayers((id) => id === MARKER_DOT_LAYER.id)).toEqual([
      MARKER_DOT_LAYER.id,
    ]);
    expect(hoverLayers(() => true)).toEqual([
      MARKER_LABEL_LAYER.id,
      MARKER_DOT_LAYER.id,
    ]);
    expect(hoverLayers(() => false)).toEqual([]);
  });
});
