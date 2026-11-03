import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ComplexContent } from "../src/screens/MarketSheets";
import { AUCTIONS, AUCTION_META } from "../src/api/fixtures";
import { ApiError } from "../src/api/client";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Auction } from "../src/api/types";

vi.mock("../src/components/Chart", () => ({ Chart: () => null }));

beforeEach(() => {
  // D-day 계산이 오늘 날짜에 기대므로 시계만 고정한다 (타이머는 그대로 둔다)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T10:00:00+09:00"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const COMPLEX_ID = "cx";
const base: Auction = {
  ...AUCTIONS[0],
  id: "court:1",
  complex_id: COMPLEX_ID,
  min_price: 360000000,
  appraisal_price: 520000000,
  min_price_ratio: 69,
  recent_trade_price: 520000000,
  fail_count: 2,
  sale_date: "2026-11-14",
  building_area_m2: 84.97,
  building_area_pyeong: 25.7,
};

function makeRepo(auctions: () => Promise<any>) {
  return {
    mode: "api",
    complex: async () => ({
      data: {
        id: COMPLEX_ID,
        name: "해운대단지",
        property_type: "apartment",
        address: "부산광역시 해운대구 우동 1",
        region_code: "2635010500",
        lat: 35.16,
        lng: 129.16,
        area_types: [{ exclusive_area_m2: 84.97, exclusive_area_pyeong: 25.7 }],
      },
    }),
    transactions: async () => ({ data: [] }),
    analysis: async () => ({ data: null }),
    stats: async () => ({ data: { trend: [], transaction_count: 0 } }),
    auctions: vi.fn(auctions),
    nearby: async () => ({ data: { schools: null } }),
  } as any;
}
const ok = (data: Auction[]) => async () => ({ data, meta: AUCTION_META });

function renderComplex(
  repo: any,
  props: Partial<React.ComponentProps<typeof ComplexContent>> = {},
) {
  return render(
    <ComplexContent
      id={COMPLEX_ID}
      repo={repo}
      filters={DEFAULT_FILTERS}
      stage="peek"
      onStage={() => {}}
      onHelp={() => {}}
      notify={() => {}}
      unit="평"
      {...props}
    />,
  );
}

describe("단지 시트의 경매 카드", () => {
  it("단지에 경매가 1건이면 '⚖ 이 단지 경매 1건' 카드를 띄우고 누르면 onAuction(id)", async () => {
    const repo = makeRepo(ok([base]));
    const onAuction = vi.fn();
    renderComplex(repo, { onAuction });
    const card = await screen.findByRole("button", {
      name: /이 단지 경매 1건/,
    });
    expect(repo.auctions.mock.calls[0][0]).toEqual({ complexId: COMPLEX_ID });
    expect(card.textContent).toContain("입찰 D-12");
    expect(card.textContent).toContain("최저가 3억 6,000만");
    expect(card.textContent).toContain("실거래보다 31%↓");
    expect(card.textContent).toContain("25.7평");
    expect(card.textContent).toContain("유찰 2회");
    fireEvent.click(card);
    expect(onAuction).toHaveBeenCalledWith("court:1");
  });

  it("여러 건이면 'N건'이고 누르면 onAuctionList(complexId, name)", async () => {
    const later = {
      ...base,
      id: "court:2",
      sale_date: "2026-12-01",
      min_price: 100000000,
    };
    const sooner = { ...base, id: "court:3", sale_date: "2026-11-05" };
    const repo = makeRepo(ok([later, sooner]));
    const onAuction = vi.fn();
    const onAuctionList = vi.fn();
    renderComplex(repo, { onAuction, onAuctionList });
    const card = await screen.findByRole("button", {
      name: /이 단지 경매 2건/,
    });
    // 기일이 가장 가까운 물건의 값을 보여준다
    expect(card.textContent).toContain("입찰 D-3");
    expect(card.textContent).toContain("최저가 3억 6,000만");
    fireEvent.click(card);
    expect(onAuctionList).toHaveBeenCalledWith(COMPLEX_ID, "해운대단지");
    expect(onAuction).not.toHaveBeenCalled();
  });

  it("보조 문구가 D-day뿐이면 헤더와 겹치지 않게 빼고 면적·유찰만 남긴다", async () => {
    const repo = makeRepo(
      ok([{ ...base, recent_trade_price: null, min_price_ratio: null }]),
    );
    renderComplex(repo);
    const card = await screen.findByRole("button", {
      name: /이 단지 경매 1건/,
    });
    expect(card.textContent).toContain("입찰 D-12");
    expect(card.textContent!.match(/D-12/g)).toHaveLength(1);
    expect(
      screen.getByText("최저가 3억 6,000만 · 25.7평 · 유찰 2회"),
    ).toBeTruthy();
  });

  it("기일 비교는 한국 날짜로 해서, 같은 날이면 서버 순서를 지킨다", async () => {
    // 공매 마감 11-14 01:00(KST)은 UTC로는 11-13이지만 한국 날짜로는 법원경매 11-14와 같은 날이다
    const court = { ...base, id: "court:4", min_price: 360000000 };
    const pub = {
      ...base,
      id: "public:5",
      source: "public" as const,
      bid_end_at: "2026-11-14T01:00:00+09:00",
      min_price: 100000000,
    };
    const repo = makeRepo(ok([court, pub]));
    renderComplex(repo);
    const card = await screen.findByRole("button", {
      name: /이 단지 경매 2건/,
    });
    expect(card.textContent).toContain("최저가 3억 6,000만");
  });

  it("최저가가 없으면 '최저가 미정', 실거래 비교가 없으면 감정가 비율로 대신한다", async () => {
    const repo = makeRepo(
      ok([{ ...base, min_price: null, recent_trade_price: null }]),
    );
    renderComplex(repo);
    const card = await screen.findByRole("button", {
      name: /이 단지 경매 1건/,
    });
    expect(card.textContent).toContain("최저가 미정");
    expect(card.textContent).toContain("감정가의 69%");
  });

  it("0건이면 카드가 없고 단지 정보는 그대로 보인다", async () => {
    const repo = makeRepo(ok([]));
    renderComplex(repo);
    await screen.findByText("해운대단지");
    await vi.waitFor(() => expect(repo.auctions).toHaveBeenCalled());
    expect(screen.queryByText(/이 단지 경매/)).toBeNull();
  });

  it.each(["NOT_FOUND", "SERVICE_UNAVAILABLE"])(
    "경매 API가 %s 오류여도 카드만 숨기고 단지는 그대로",
    async (code) => {
      const repo = makeRepo(async () => {
        throw new ApiError("auction down", code);
      });
      renderComplex(repo);
      await screen.findByText("해운대단지");
      await vi.waitFor(() => expect(repo.auctions).toHaveBeenCalled());
      expect(screen.queryByText(/이 단지 경매/)).toBeNull();
      expect(screen.queryByText(/auction down/)).toBeNull();
    },
  );

  it("단지가 바뀌면 이전 요청을 취소하고 이전 단지의 카드를 지운다", async () => {
    const signals: AbortSignal[] = [];
    const repo = makeRepo(async () => ({ data: [], meta: AUCTION_META }));
    repo.auctions = vi.fn(async (_q: any, signal: AbortSignal) => {
      signals.push(signal);
      return { data: [base], meta: AUCTION_META };
    });
    const view = renderComplex(repo);
    await screen.findByRole("button", { name: /이 단지 경매 1건/ });
    view.rerender(
      <ComplexContent
        id="other"
        repo={repo}
        filters={DEFAULT_FILTERS}
        stage="peek"
        onStage={() => {}}
        onHelp={() => {}}
        notify={() => {}}
        unit="평"
      />,
    );
    expect(signals[0].aborted).toBe(true);
    expect(repo.auctions.mock.calls[1][0]).toEqual({ complexId: "other" });
  });

  it("full 단계에서도 카드가 보인다(데스크톱은 항상 full)", async () => {
    const repo = makeRepo(ok([base]));
    renderComplex(repo, { stage: "full" });
    await screen.findByRole("button", { name: /이 단지 경매 1건/ });
  });
});
