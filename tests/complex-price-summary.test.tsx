import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ComplexContent } from "../src/screens/MarketSheets";
import { COMPLEXES } from "../src/api/fixtures";
import { DEFAULT_FILTERS, complexPriceSummary } from "../src/state/market";

vi.mock("../src/components/Chart", () => ({ Chart: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("complexPriceSummary: 평형 시세 헤더", () => {
  // 평당가는 전용면적 기준이라 한 평형 안에서는 중위 평당가 × 전용평수 = 중위 거래가
  it("매매는 평당가 중위값에 전용평수를 곱한 거래가를 보여준다", () => {
    expect(
      complexPriceSummary(
        { median_price_per_pyeong: 40_000_000 },
        "sale",
        84.9,
      ),
    ).toBe("10.3억");
  });
  it("전세는 평당 보증금 중위값으로 보증금을 보여준다", () => {
    expect(
      complexPriceSummary(
        { median_deposit_per_pyeong: 20_000_000 },
        "jeonse",
        59.9,
      ),
    ).toBe("3.6억");
  });
  it("월세는 보증금·월세 중위값을 그대로 보여준다", () => {
    expect(
      complexPriceSummary(
        { median_deposit: 50_000_000, median_monthly_rent: 1_200_000 },
        "monthly",
        84.9,
      ),
    ).toBe("5,000만 / 120만");
  });
  it("값이 없으면 null", () => {
    expect(complexPriceSummary({}, "sale", 84.9)).toBeNull();
    expect(complexPriceSummary(undefined, "sale", 84.9)).toBeNull();
    expect(
      complexPriceSummary({ median_price_per_pyeong: 1 }, "sale", undefined),
    ).toBeNull();
  });
});

describe("단지 상세 평당가 그래프 헤더", () => {
  it("선택한 평형의 거래가 중위값을 그래프 위에 보여준다", async () => {
    const complex = COMPLEXES[0];
    const ar = complex.area_types[0];
    const repo = {
      mode: "api",
      complex: async () => ({ data: complex }),
      transactions: async () => ({
        data: [],
        meta: { page: 1, total_pages: 1, total: 0 },
      }),
      analysis: async () => ({ data: null }),
      stats: async () => ({
        data: {
          trend: [],
          transaction_count: 3,
          area_types: [
            {
              ...ar,
              transaction_count: 3,
              median_price_per_pyeong: 40_000_000,
              trend: [],
            },
          ],
        },
      }),
      auctions: async () => ({ data: [] }),
      nearby: async () => ({ data: null }),
    } as any;
    render(
      <ComplexContent
        id={complex.id}
        repo={repo}
        filters={DEFAULT_FILTERS}
        stage="half"
        onStage={() => {}}
        onHelp={() => {}}
        notify={() => {}}
        unit="평"
      />,
    );
    const expected = complexPriceSummary(
      { median_price_per_pyeong: 40_000_000 },
      "sale",
      ar.exclusive_area_m2,
    )!;
    expect(await screen.findByText(expected)).toBeTruthy();
    expect(screen.getByText(/거래가 중위값/)).toBeTruthy();
  });
});
