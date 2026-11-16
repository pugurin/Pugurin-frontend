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
import { DEFAULT_FILTERS } from "../src/state/market";

vi.mock("../src/components/Chart", () => ({ Chart: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const COMPLEX = COMPLEXES[0];

function makeRepo() {
  const data = [
    {
      ...TRANSACTIONS[0],
      id: "tx-ok",
      is_cancelled: false,
      cancelled_at: null,
    },
    {
      ...TRANSACTIONS[0],
      id: "tx-cancel",
      is_cancelled: true,
      cancelled_at: "2026-09-21T10:00:00+09:00",
    },
  ];
  return {
    mode: "api",
    complex: async () => ({ data: COMPLEX }),
    transactions: vi.fn(async () => ({
      data,
      meta: { page: 1, total_pages: 1, total: data.length },
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

describe("단지 상세의 해제(이상) 거래", () => {
  it("처음부터 해제 거래를 함께 불러와 해제 표시로 보여준다", async () => {
    const repo = makeRepo();
    renderFull(repo);
    await screen.findByText("해제");
    expect(repo.transactions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ complexId: COMPLEX.id, cancelled: true }),
      expect.anything(),
    );
    expect(
      screen
        .getByRole("checkbox", { name: /해제 거래 포함/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("해제 거래 포함을 끄면 해제 거래 없이 다시 부른다", async () => {
    const repo = makeRepo();
    renderFull(repo);
    await screen.findByText("해제");
    fireEvent.click(screen.getByRole("checkbox", { name: /해제 거래 포함/ }));
    await waitFor(() =>
      expect(repo.transactions).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ cancelled: false }),
        expect.anything(),
      ),
    );
  });
});
