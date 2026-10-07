import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ComplexContent, RegionContent } from "../src/screens/MarketSheets";
import { DEFAULT_FILTERS } from "../src/state/market";
vi.mock("../src/components/Chart", () => ({
  Chart: ({ trend, comparison, metric }: any) => (
    <div>{JSON.stringify({ trend, comparison, metric })}</div>
  ),
}));
afterEach(cleanup);
const trend = (v: number) => [
  { month: "2026-09", count: 3, median_price_per_pyeong: v },
];
it("단지 평형 선택은 서버 평형별 통계로 바뀌고 실제 지역 비교를 받는다", async () => {
  const repo: any = {
    mode: "api",
    complex: async () => ({
      data: {
        id: "c",
        name: "단지",
        property_type: "apartment",
        address: "부산 우동",
        region_code: "2635010500",
        area_types: [
          { exclusive_area_m2: 59, exclusive_area_pyeong: 17.8 },
          { exclusive_area_m2: 84, exclusive_area_pyeong: 25.4 },
        ],
      },
    }),
    transactions: async () => ({ data: [] }),
    analysis: async () => ({ data: null }),
    stats: async (_: any, id: string, kind: string) => ({
      data:
        kind === "region"
          ? { trend: trend(150), transaction_count: 6 }
          : {
              trend: trend(200),
              transaction_count: 6,
              area_types: [
                {
                  exclusive_area_m2: 59,
                  trend: trend(100),
                  transaction_count: 3,
                },
                {
                  exclusive_area_m2: 84,
                  trend: trend(300),
                  transaction_count: 3,
                },
              ],
            },
    }),
  };
  render(
    <ComplexContent
      id="c"
      repo={repo}
      filters={DEFAULT_FILTERS}
      stage="half"
      onStage={() => {}}
      onHelp={() => {}}
      notify={() => {}}
      unit="평"
    />,
  );
  await screen.findByText((t) => t.includes('median_price_per_pyeong":100'));
  await screen.findByText((t) => t.includes('median_price_per_pyeong":150'));
  fireEvent.click(screen.getByText("전용 25.4평"));
  await screen.findByText((t) => t.includes('median_price_per_pyeong":300'));
});
it("지역 통계가 성공하면 거래 목록 실패와 별개로 통계를 표시한다", async () => {
  const repo: any = {
    mode: "api",
    stats: async () => ({
      data: {
        trend: trend(777),
        median_price_per_pyeong: 777,
        transaction_count: 42,
      },
    }),
    transactions: async () => {
      throw new Error("지역 거래 목록 API가 준비 중이에요");
    },
  };
  render(
    <RegionContent
      marker={{
        kind: "region",
        name: "우동",
        region_code: "2635010500",
        lat: 35,
        lng: 129,
        transaction_count: 1,
        summary: {},
      }}
      repo={repo}
      filters={DEFAULT_FILTERS}
      onList={() => {}}
      onComplex={() => {}}
      onHelp={() => {}}
      unit="평"
    />,
  );
  await screen.findByText("42건");
  expect(
    screen.getByText((t) => t.includes('median_price_per_pyeong":777')),
  ).toBeTruthy();
  expect(
    screen.queryByText("지역 통계·거래 목록 API가 준비 중이에요"),
  ).toBeNull();
});

it("지도 유형과 다른 검색 단지도 실제 단지 유형으로 통계를 조회한다", async () => {
  const stats = vi.fn(async (filters: any) => {
    if (filters.property_type !== "officetel")
      throw new Error("잘못된 매물 유형");
    return { data: { trend: trend(123), transaction_count: 3 } };
  });
  const repo: any = {
    mode: "api",
    complex: async () => ({
      data: {
        id: "o",
        name: "오피스텔",
        property_type: "officetel",
        address: "부산",
        region_code: "2635010500",
        area_types: [],
      },
    }),
    transactions: async () => ({ data: [] }),
    analysis: async () => ({ data: null }),
    stats,
  };
  render(
    <ComplexContent
      id="o"
      repo={repo}
      filters={DEFAULT_FILTERS}
      stage="half"
      onStage={() => {}}
      onHelp={() => {}}
      notify={() => {}}
      unit="평"
    />,
  );
  await screen.findByText((t) => t.includes('median_price_per_pyeong":123'));
  expect(stats.mock.calls.every(([f]) => f.property_type === "officetel")).toBe(
    true,
  );
});
