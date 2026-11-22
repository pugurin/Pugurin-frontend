import { describe, expect, it } from "vitest";
import {
  HATCH_SPACING_PX,
  hatchSegments,
  redevelopmentZoneShapes,
  type LngLat,
} from "../src/state/redevelopment";
import type { RedevelopmentZone } from "../src/api/types";

// (129, 35) 근처 경도·위도 1m
const M_LNG = 1 / (111320 * Math.cos((35 * Math.PI) / 180));
const M_LAT = 1 / 110540;
const at = (x: number, y: number): LngLat => [129 + x * M_LNG, 35 + y * M_LAT];
const square = (x0: number, y0: number, size: number): LngLat[] => [
  at(x0, y0),
  at(x0 + size, y0),
  at(x0 + size, y0 + size),
  at(x0, y0 + size),
  at(x0, y0),
];
const inside = (
  [lng, lat]: LngLat,
  x0: number,
  y0: number,
  size: number,
  eps = 0.01,
) => {
  const x = (lng - 129) / M_LNG;
  const y = (lat - 35) / M_LAT;
  return (
    x >= x0 - eps &&
    x <= x0 + size + eps &&
    y >= y0 - eps &&
    y <= y0 + size + eps
  );
};
const mid = ([a, b]: [LngLat, LngLat]): LngLat => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
];

describe("정비구역 빗금", () => {
  it("구역 안에만 일정한 간격의 사선을 긋는다", () => {
    const segs = hatchSegments([square(0, 0, 100)], 10);
    // 대각선 방향 폭 200m를 수직 간격 10m(사선 방향으로 14.1m)로 나눈 만큼
    expect(segs.length).toBeGreaterThanOrEqual(13);
    expect(segs.length).toBeLessThanOrEqual(15);
    for (const s of segs) {
      expect(inside(s[0], 0, 0, 100)).toBe(true);
      expect(inside(s[1], 0, 0, 100)).toBe(true);
    }
  });

  it("구멍 안에는 긋지 않는다", () => {
    const hole = square(30, 30, 40).reverse();
    const segs = hatchSegments([square(0, 0, 100), hole], 10);
    expect(segs.some((s) => inside(mid(s), 31, 31, 38, 0))).toBe(false);
    // 구멍을 지나는 선은 둘로 나뉘어 선분이 늘어난다
    expect(segs.length).toBeGreaterThan(
      hatchSegments([square(0, 0, 100)], 10).length,
    );
  });

  it("너무 촘촘하면 긋지 않는다(멀리서 본 큰 구역)", () => {
    expect(hatchSegments([square(0, 0, 100)], 0.01)).toEqual([]);
  });
});

const zone = (over: Partial<RedevelopmentZone>): RedevelopmentZone => ({
  zone_id: "Z1",
  name: "가상1재개발정비구역",
  notice: null,
  designated_on: "2020-01-01",
  geometry: { type: "MultiPolygon", coordinates: [[square(0, 0, 100)]] },
  redevelopment_id: null,
  area_name: null,
  kind: null,
  stage: null,
  ...over,
});

describe("지도에 넘길 정비구역 도형", () => {
  it("구역마다 테두리 고리와 줌에 맞춘 빗금, 고른 구역 표시를 넘긴다", () => {
    const [s] = redevelopmentZoneShapes([zone({})], 15, "redevzone:Z1");
    expect(s.id).toBe("redevzone:Z1");
    expect(s.selected).toBe(true);
    expect(s.polygons).toEqual([[square(0, 0, 100)]]);
    // 줌 15는 1px = 1m라 간격 HATCH_SPACING_PX m
    expect(s.hatch).toEqual(
      hatchSegments([square(0, 0, 100)], HATCH_SPACING_PX),
    );
    // 줌을 줄이면 간격이 넓어져 선이 줄어든다
    const [far] = redevelopmentZoneShapes([zone({})], 14, null);
    expect(far.selected).toBe(false);
    expect(far.hatch.length).toBeLessThan(s.hatch.length);
  });
});
