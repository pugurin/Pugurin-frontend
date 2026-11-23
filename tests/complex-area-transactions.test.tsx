import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ComplexContent } from "../src/screens/MarketSheets";
import { COMPLEXES, TRANSACTIONS } from "../src/api/fixtures";
import { DEFAULT_FILTERS, nearestArea } from "../src/state/market";

vi.mock("../src/components/Chart", () => ({ Chart: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const COMPLEX = COMPLEXES[0];
const [SMALL, LARGE] = COMPLEX.area_types;

// 서버는 면적을 가리지 않고 정렬만 한 거래를 준다
const tx = (id: string, area: number, price: number) => ({
  ...TRANSACTIONS[0],
  id,
  complex_id: COMPLEX.id,
  exclusive_area_m2: area,
  exclusive_area_pyeong: Math.round((area / 3.3058) * 10) / 10,
  price,
  deal_type: "sale" as const,
  deposit: null,
  monthly_rent: null,
  is_cancelled: false,
  cancelled_at: null,
});

function makeRepo(pages: ReturnType<typeof tx>[][]) {
  return {
    mode: "api",
    complex: async () => ({ data: COMPLEX }),
    transactions: vi.fn(async (_f: unknown, o: { page?: number }) => ({
      data: pages[(o.page ?? 1) - 1] ?? [],
      meta: { page: o.page ?? 1, total_pages: pages.length, total: 0 },
    })),
    analysis: async () => ({ data: null }),
    stats: async () => ({ data: { trend: [], transaction_count: 0 } }),
    auctions: async () => ({ data: [] }),
    nearby: async () => ({ data: null }),
  } as any;
}

function renderFull(repo: any) {
  return render(
    <ComplexContent
      id={COMPLEX.id}
      repo={repo}
      filters={DEFAULT_FILTERS}
      stage="full"
      onStage={() => {}}
      onHelp={() => {}}
      notify={() => {}}
      unit="평"
    />,
  );
}

// 거래 이력 줄의 가격 문구(억 단위)를 순서대로
const prices = () =>
  screen.queryAllByText(/^[\d.]+억$/).map((n) => n.textContent);

describe("단지 거래 이력의 평형 필터", () => {
  it("선택한 평형의 거래만 서버 정렬 순서대로 보여준다", async () => {
    const repo = makeRepo([
      [
        tx("a", LARGE.exclusive_area_m2, 200000000),
        tx("b", SMALL.exclusive_area_m2, 150000000),
        tx("c", LARGE.exclusive_area_m2, 180000000),
        tx("d", SMALL.exclusive_area_m2 + 0.3, 120000000),
      ],
    ]);
    renderFull(repo);
    // 처음엔 첫 평형이 골라져 있다
    await waitFor(() => expect(prices()).toEqual(["1.5억", "1.2억"]));
    fireEvent.click(screen.getByText(/^45평형/));
    await waitFor(() => expect(prices()).toEqual(["2억", "1.8억"]));
    expect(screen.queryByText("거래 이력은 모든 면적을 표시해요")).toBeNull();
  });

  it("불러온 거래에 고른 평형이 적으면 다음 쪽을 이어서 불러온다", async () => {
    const repo = makeRepo([
      [tx("a", LARGE.exclusive_area_m2, 200000000)],
      [tx("b", SMALL.exclusive_area_m2, 150000000)],
    ]);
    renderFull(repo);
    await waitFor(() => expect(prices()).toEqual(["1.5억"]));
    expect(repo.transactions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 2 }),
      expect.anything(),
    );
  });

  it("평형을 바꿔도 옛 목록 뒤에 같은 거래를 다시 붙이지 않는다", async () => {
    const repo = makeRepo([
      [tx("a", LARGE.exclusive_area_m2, 200000000)],
      [
        tx("b", SMALL.exclusive_area_m2, 150000000),
        tx("c", LARGE.exclusive_area_m2, 180000000),
      ],
    ]);
    renderFull(repo);
    await waitFor(() => expect(prices()).toEqual(["1.5억"]));
    fireEvent.click(screen.getByText(/^45평형/));
    await waitFor(() => expect(prices()).toEqual(["2억", "1.8억"]));
    await new Promise((r) => setTimeout(r, 300));
    expect(prices()).toEqual(["2억", "1.8억"]);
  });

  it("단지 거래 이력은 한 쪽에 100건씩 받는다", async () => {
    // 20건씩이면 가격 낮은순에서 큰 평형이 자동 불러오기 한도(5쪽) 뒤로 밀려 안 보였다
    const repo = makeRepo([[tx("a", SMALL.exclusive_area_m2, 150000000)]]);
    renderFull(repo);
    await waitFor(() => expect(prices()).toEqual(["1.5억"]));
    expect(repo.transactions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pageSize: 100 }),
      expect.anything(),
    );
  });

  it("고른 평형 거래가 없으면 비었다고 알린다", async () => {
    const repo = makeRepo([[tx("a", LARGE.exclusive_area_m2, 200000000)]]);
    renderFull(repo);
    await screen.findByText("이 평형의 거래가 없어요");
  });
});

describe("nearestArea", () => {
  const areas = [98.48, 98.55, 110.45].map((m) => ({ exclusive_area_m2: m }));
  it("붙은 평형에서도 가장 가까운 한 곳에만 넣는다", () => {
    expect(nearestArea(98.5, areas)?.exclusive_area_m2).toBe(98.48);
    expect(nearestArea(98.53, areas)?.exclusive_area_m2).toBe(98.55);
  });
  it("목록과 소수점이 다른 신고 면적도 가까운 평형에 넣는다", () => {
    expect(nearestArea(110.123, areas)?.exclusive_area_m2).toBe(110.45);
  });
  it("1㎡ 넘게 떨어지거나 면적을 모르면 넣지 않는다", () => {
    expect(nearestArea(105, areas)).toBeUndefined();
    expect(nearestArea(null, areas)).toBeUndefined();
  });
});
