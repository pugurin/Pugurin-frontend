import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ComplexContent } from "../src/screens/MarketSheets";
import { COMPLEXES, TRANSACTIONS } from "../src/api/fixtures";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Filters, Transaction } from "../src/api/types";

vi.mock("../src/components/Chart", () => ({ Chart: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const COMPLEX = COMPLEXES[0];
const AREA = COMPLEX.area_types[0].exclusive_area_m2;

// 지도 필터대로 거래를 돌려주는 가짜 저장소. 매매 요청에만 매매 거래가 들어 있다
function makeRepo() {
  const sale: Transaction = {
    ...TRANSACTIONS[0],
    id: "sale-1",
    deal_type: "sale",
    price: 6.2e8,
    exclusive_area_m2: AREA,
    is_cancelled: false,
    contract_date: "2026-10-01",
  };
  const jeonse: Transaction = {
    ...sale,
    id: "jeonse-1",
    deal_type: "jeonse",
    price: null,
    deposit: 3e8,
  };
  const transactions = vi.fn(async (f: Filters) => ({
    data: f.deal_type === "sale" ? [sale] : [jeonse],
    meta: { page: 1, total_pages: 1, total: 1 },
  }));
  return {
    transactions,
    repo: {
      mode: "api",
      complex: async () => ({ data: COMPLEX }),
      transactions,
      analysis: async () => ({ data: null }),
      stats: async () => ({ data: { trend: [], transaction_count: 0 } }),
      auctions: async () => ({ data: [] }),
      nearby: async () => ({ data: { schools: null } }),
    } as any,
  };
}

describe("단지 상세 대출 계산기 기본 매매가", () => {
  it("지도를 전세로 보고 있어도 매매 거래를 따로 불러와 매매가를 채운다", async () => {
    const { repo, transactions } = makeRepo();
    render(
      <ComplexContent
        id={COMPLEX.id}
        repo={repo}
        filters={{ ...DEFAULT_FILTERS, deal_type: "jeonse" }}
        stage="full"
        onStage={() => {}}
        onHelp={() => {}}
        notify={() => {}}
        unit="평"
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/최근 매매 실거래가 6억 2,000만 기준이에요/),
      ).toBeTruthy(),
    );
    expect(
      transactions.mock.calls.some(
        ([f, o]: any) => f.deal_type === "sale" && o.cancelled === false,
      ),
    ).toBe(true);
  });
});
