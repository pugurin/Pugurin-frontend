import React from "react";
import { it, expect, vi, afterEach, describe } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ComplexContent } from "../src/screens/MarketSheets";
import { DEFAULT_FILTERS } from "../src/state/market";
vi.mock("../src/components/Chart", () => ({
  Chart: () => <div>차트</div>,
}));
afterEach(cleanup);
// 면적 칩은 거래 줄과 같은 areaLabel 규칙으로 적는다: "20평형(전용 15.8평)",
// 공급 평형을 모르면 "전용 37.9평". 모든 칩에 전용면적이 붙어 서로 비교할 수 있다.
// 칩은 서버 순서와 상관없이 전용면적이 작은 평형부터 놓는다.
const repo: any = {
  mode: "api",
  complex: async () => ({
    data: {
      id: "c",
      name: "현대",
      property_type: "apartment",
      address: "부산 수영동",
      region_code: "2650010400",
      // 일부러 순서를 섞어 둔다. 칩은 전용면적 순으로 놓여야 한다
      area_types: [
        { exclusive_area_m2: 125.3, exclusive_area_pyeong: 37.9 },
        {
          exclusive_area_m2: 52.2,
          exclusive_area_pyeong: 15.8,
          supply_area_pyeong: 20,
        },
        {
          exclusive_area_m2: 79.3,
          exclusive_area_pyeong: 24,
          supply_area_pyeong: 29,
        },
      ],
    },
  }),
  transactions: async () => ({ data: [] }),
  analysis: async () => ({ data: null }),
  auctions: async () => ({ data: [] }),
  stats: async () => ({ data: { trend: [], transaction_count: 0 } }),
};
const renderSheet = (unit: "평" | "㎡") =>
  render(
    <ComplexContent
      id="c"
      repo={repo}
      filters={DEFAULT_FILTERS}
      stage="half"
      onStage={() => {}}
      onHelp={() => {}}
      notify={() => {}}
      unit={unit}
    />,
  );
// 칩 문구만 고른다. 칩 아래 문구는 " 기준"으로 끝나서 걸리지 않는다
const chipTexts = () =>
  screen
    .getAllByText(/^(\d+(평|㎡)형\()?전용 [\d.]+(평|㎡)\)?$/)
    .map((el) => el.textContent);

describe("단지 시트 면적 칩", () => {
  it("칩을 areaLabel 규칙으로, 전용면적이 작은 평형부터 적는다", async () => {
    renderSheet("평");
    await screen.findByText("현대");
    expect(chipTexts()).toEqual([
      "20평형(전용 15.8평)",
      "29평형(전용 24평)",
      "전용 37.9평",
    ]);
  });
  it("㎡로 바꾸면 칩도 ㎡로 적는다", async () => {
    renderSheet("㎡");
    await screen.findByText("현대");
    expect(chipTexts()).toEqual([
      "66㎡형(전용 52.2㎡)",
      "96㎡형(전용 79.3㎡)",
      "전용 125.3㎡",
    ]);
  });
  it("칩 아래 문구는 선택한 평형을 같은 규칙으로 적는다", async () => {
    renderSheet("평");
    await screen.findByText("현대");
    // 처음에는 정렬된 첫 칩(가장 작은 평형)이 골라진다
    expect(screen.getByText("20평형(전용 15.8평) 기준")).toBeTruthy();
    fireEvent.click(screen.getByText("전용 37.9평"));
    expect(screen.getByText("전용 37.9평 기준")).toBeTruthy();
  });
  it("㎡일 때 칩 아래 문구도 ㎡로 적는다", async () => {
    renderSheet("㎡");
    await screen.findByText("현대");
    expect(screen.getByText("66㎡형(전용 52.2㎡) 기준")).toBeTruthy();
  });
});

describe("단지 시트 평형 평균가", () => {
  it("고른 평형의 최근 1년 평균 매매가와 건수를 칩 아래에 적는다", async () => {
    const { monthsAgo } = await import("../src/state/areaAverage");
    const recent = monthsAgo(1);
    const sale = (price: number, m2: number) => ({
      id: `t${price}`,
      deal_type: "sale",
      price,
      deposit: null,
      monthly_rent: null,
      exclusive_area_m2: m2,
      contract_date: recent,
      is_cancelled: false,
    });
    const withTx = {
      ...repo,
      transactions: async () => ({
        data: [sale(3e8, 52.2), sale(4e8, 52.4), sale(9e8, 125.3)],
        meta: { page: 1, total_pages: 1 },
      }),
    };
    render(
      <ComplexContent
        id="c"
        repo={withTx}
        filters={DEFAULT_FILTERS}
        stage="half"
        onStage={() => {}}
        onHelp={() => {}}
        notify={() => {}}
        unit="평"
      />,
    );
    expect(
      await screen.findByText("최근 1년 평균 매매가 3.5억 · 거래 2건"),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("29평형(전용 24평)"));
    expect(screen.getByText("최근 1년 이 평형 거래 없음")).toBeTruthy();
  });
});
