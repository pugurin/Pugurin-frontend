import { describe, expect, it } from "vitest";
import { AUCTIONS, sampleMarkers } from "../src/api/fixtures";
import type { ComplexMarker } from "../src/api/types";
import { DEFAULT_FILTERS } from "../src/state/market";

const complexes = (deal: "sale" | "jeonse" | "monthly") =>
  sampleMarkers({ ...DEFAULT_FILTERS, deal_type: deal }, [128.8, 35, 129.4, 35.4], 15).data
    .markers as ComplexMarker[];

describe("샘플 데이터의 같은 평형 평균가", () => {
  it("단지 마커에 거래 많은 평형(typical)을 싣는다", () => {
    const ms = complexes("sale");
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) {
      expect(m.kind).toBe("complex");
      expect(m.typical?.avg_price).toBeGreaterThan(0);
      expect(m.typical?.avg_deposit).toBeNull();
      expect(m.typical!.transaction_count).toBeLessThanOrEqual(m.transaction_count);
    }
    // 공급 평형이 없는 단지도 하나는 있어 전용 평 표기를 볼 수 있다
    expect(ms.some((m) => m.typical?.supply_area_pyeong == null)).toBe(true);
  });
  it("전세는 평균 보증금, 월세는 평균 보증금·월세", () => {
    const j = complexes("jeonse")[0].typical!;
    expect(j.avg_price).toBeNull();
    expect(j.avg_deposit).toBeGreaterThan(0);
    expect(j.avg_monthly_rent).toBeNull();
    const m = complexes("monthly")[0].typical!;
    expect(m.avg_deposit).toBeGreaterThan(0);
    expect(m.avg_monthly_rent).toBeGreaterThan(0);
  });
  it("경매 샘플에 같은 평형 평균가와 공급 평형이 있다", () => {
    expect(AUCTIONS[0].recent_trade_avg_price).toBeGreaterThan(0);
    expect(AUCTIONS[0].recent_trade_supply_area_pyeong).toBe(34);
  });
});
