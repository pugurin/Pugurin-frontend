import React from "react";
import { it, expect, vi, afterEach, describe } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ComplexContent } from "../src/screens/MarketSheets";
import { DEFAULT_FILTERS } from "../src/state/market";
vi.mock("../src/components/Chart", () => ({
  Chart: () => <div>차트</div>,
}));
afterEach(cleanup);
// 면적 칩은 모두 전용면적으로 적는다. 공급면적이 있는 평형과 없는 평형이 섞이면
// "29평"(공급)과 "전용 37.9평"을 한 줄에서 비교하게 돼 헷갈렸다.
// 공급면적은 선택한 칩 아래 문구에서만 보여준다.
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
const chipTexts = () =>
  screen.getAllByText(/^전용 [\d.]+(평|㎡)$/).map((el) => el.textContent);

describe("단지 시트 면적 칩", () => {
  it("모든 칩을 전용면적으로, 작은 평형부터 적는다", async () => {
    renderSheet("평");
    await screen.findByText("현대");
    expect(chipTexts()).toEqual(["전용 15.8평", "전용 24평", "전용 37.9평"]);
    expect(screen.queryByText("20평")).toBeNull();
  });
  it("㎡로 바꾸면 칩도 ㎡로 적는다", async () => {
    renderSheet("㎡");
    await screen.findByText("현대");
    expect(chipTexts()).toEqual(["전용 52.2㎡", "전용 79.3㎡", "전용 125.3㎡"]);
  });
  it("선택한 평형의 공급면적과 전용면적을 칩 아래에 적는다", async () => {
    renderSheet("평");
    await screen.findByText("현대");
    expect(screen.getByText("공급 20평 · 전용 15.8평")).toBeTruthy();
    fireEvent.click(screen.getByText("전용 37.9평"));
    // 공급면적이 없는 평형은 전용면적만 적는다
    expect(screen.getByText("공급면적 정보 없음 · 전용 37.9평")).toBeTruthy();
  });
  it("㎡일 때 칩 아래 문구도 ㎡로 적는다", async () => {
    renderSheet("㎡");
    await screen.findByText("현대");
    expect(screen.getByText("공급 66.1㎡ · 전용 52.2㎡")).toBeTruthy();
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
    fireEvent.click(screen.getByText("전용 24평"));
    expect(screen.getByText("최근 1년 이 평형 거래 없음")).toBeTruthy();
  });
});
