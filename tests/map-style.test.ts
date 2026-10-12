import { describe, it, expect } from "vitest";
import {
  baseStyle,
  fromMapZoom,
  koreanLabels,
  markerFeatures,
  markerLines,
  toMapZoom,
} from "../src/map/style";
import type { ComplexMarker, RegionMarker } from "../src/api/types";

const region: RegionMarker = {
  kind: "region",
  region_code: "2635010500",
  name: "우동",
  lat: 35.16,
  lng: 129.16,
  transaction_count: 1280,
  summary: { median_price_per_pyeong: 32000000 },
};
const complex = (latest: Partial<ComplexMarker["latest"]>): ComplexMarker => ({
  kind: "complex",
  complex_id: "c1",
  name: "해운대아이파크",
  lat: 35.15,
  lng: 129.14,
  transaction_count: 21,
  latest: {
    deal_type: "sale",
    price: 1450000000,
    exclusive_area_pyeong: 25.7,
    supply_area_pyeong: 34,
    contract_date: "2026-08-14",
    ...latest,
  },
});

describe("줌 변환", () => {
  it("MapLibre 줌은 화면·API 줌보다 1 작다", () => {
    expect(toMapZoom(12)).toBe(11);
    expect(fromMapZoom(11)).toBe(12);
    expect(fromMapZoom(toMapZoom(14.4))).toBeCloseTo(14.4);
  });
});

describe("마커 글자", () => {
  it("구·동 마커는 지역명 / 평당가 / 건수", () => {
    expect(markerLines(region, "평")).toEqual({
      title: "우동",
      amount: "평당 3,200만",
      sub: "1,280건",
    });
  });
  it("월세 구·동 마커는 보증금·월세 중위값", () => {
    const m = { ...region, summary: { median_deposit: 50000000, median_monthly_rent: 800000 } };
    expect(markerLines(m, "평").amount).toBe("보증금 5,000 · 월 80");
  });
  it("단지 매매는 금액 / 공급 평형 · 계약월", () => {
    expect(markerLines(complex({}), "평")).toMatchObject({ amount: "14.5억", sub: "34평 · '26.08" });
  });
  it("공급 평형이 없으면 전용임을 밝힌다", () => {
    expect(markerLines(complex({ supply_area_pyeong: null }), "평").sub).toBe("전용 25.7평 · '26.08");
  });
  it("전세·월세 단지 표기", () => {
    expect(markerLines(complex({ deal_type: "jeonse", price: null, deposit: 500000000 }), "평").amount).toBe("전세 5억");
    expect(
      markerLines(complex({ deal_type: "monthly", price: null, deposit: 50000000, monthly_rent: 800000 }), "평").amount,
    ).toBe("5,000/80");
  });
  it("㎡ 단위로 바꿔 표시한다", () => {
    expect(markerLines(complex({}), "㎡").sub).toBe("112.4㎡ · '26.08");
  });
});

describe("마커 GeoJSON", () => {
  it("선택된 마커는 먹색 배경과 가장 높은 우선순위를 가진다", () => {
    const fc = markerFeatures([region, complex({})], "apartment", "평", "c1");
    const [r, c] = fc.features.map((f) => f.properties!);
    expect(c).toMatchObject({ id: "c1", box: "box-selected", rank: 0 });
    expect(r).toMatchObject({ box: "box-apartment", region: true, rank: 1 });
    expect(fc.features[1].geometry.coordinates).toEqual([129.14, 35.15]);
  });
});

describe("배경 스타일", () => {
  it("VWorld 키가 없으면 받아 둔 OpenFreeMap 스타일을 그대로 쓰고, 지적도는 넣지 않는다", () => {
    const free = { version: 8 as const, sources: {}, layers: [{ id: "x", type: "background" as const }] };
    expect(baseStyle("normal", true, free)).toBe(free);
  });
  it("OpenFreeMap 지명은 한글 우선으로 바꾼다", () => {
    const s = koreanLabels({
      version: 8,
      sources: {},
      layers: [
        { id: "label", type: "symbol", source: "o", layout: { "text-field": "{name}" } },
        { id: "road", type: "line", source: "o" },
      ],
    });
    expect((s.layers[0] as { layout: Record<string, unknown> }).layout["text-field"]).toEqual([
      "coalesce",
      ["get", "name:ko"],
      ["get", "name:nonlatin"],
      ["get", "name"],
    ]);
    expect(s.layers[1]).toEqual({ id: "road", type: "line", source: "o" });
  });
});
