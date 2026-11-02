import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AuctionsScreen } from "../src/screens/AuctionsScreen";
import { ApiError } from "../src/api/client";
import { AUCTIONS, AUCTION_META } from "../src/api/fixtures";
import type { Auction, BBox, Meta } from "../src/api/types";

// AUCTION_SERVER_SORT를 테스트마다 바꿀 수 있게 getter로 둔다
const flag = vi.hoisted(() => ({ sort: true }));
vi.mock("../src/state/auction", async (orig) => {
  const actual = await orig<typeof import("../src/state/auction")>();
  return Object.defineProperty({ ...actual }, "AUCTION_SERVER_SORT", {
    get: () => flag.sort,
    enumerable: true,
  });
});

beforeEach(() => {
  flag.sort = true;
  // D-day 계산이 오늘 날짜에 기대므로 시계만 고정한다 (타이머는 그대로 둔다)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T10:00:00+09:00"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const BBOX: BBox = [129.0, 35.0, 129.2, 35.2];
const row = (n: number, extra: Partial<Auction> = {}): Auction => ({
  ...AUCTIONS[0],
  id: `court:${n}`,
  case_no: `2026타경${n}`,
  title: `테스트 물건 ${n}`,
  min_price: 360000000,
  appraisal_price: 520000000,
  min_price_ratio: 69,
  fail_count: 2,
  sale_date: "2026-11-14",
  building_area_m2: 84.97,
  building_area_pyeong: 25.7,
  is_share: false,
  is_closed: false,
  ...extra,
});
// 서버가 오래돼 recent_trade_price 키가 아예 없는 줄
const withoutTrade = (n: number): Auction => {
  const { recent_trade_price: _, ...rest } = row(n);
  return rest;
};
const meta = (total: number, page = 1, total_pages = 1): Meta => ({
  ...AUCTION_META,
  total,
  page,
  total_pages,
});

function setup(
  impl: (q: any) => Promise<any> = async () => ({
    data: [row(1)],
    meta: meta(1),
  }),
  props: Partial<React.ComponentProps<typeof AuctionsScreen>> = {},
) {
  const auctions = vi.fn((q: any) => impl(q));
  const onBack = vi.fn();
  const onAuction = vi.fn();
  render(
    <AuctionsScreen
      repo={{ mode: "api", auctions } as any}
      bbox={BBOX}
      property="apartment"
      onBack={onBack}
      onAuction={onAuction}
      {...props}
    />,
  );
  return { auctions, onBack, onAuction };
}
const lastQuery = (auctions: ReturnType<typeof vi.fn>) =>
  auctions.mock.calls.at(-1)![0];

describe("경매 목록 화면", () => {
  it("헤더에 '경매 물건 · 지도 화면 안 N건'(meta.total)과 줄마다 D-day·최저가·감정가 %·유찰을 보여준다", async () => {
    const { auctions } = setup(async () => ({
      data: [row(1), row(2, { source: "public", is_share: true })],
      meta: meta(37),
    }));
    expect(await screen.findByText("테스트 물건 1")).toBeTruthy();
    expect(screen.getByText("경매 물건 · 지도 화면 안 37건")).toBeTruthy();
    expect(screen.getAllByText("D-12")).toHaveLength(2);
    expect(screen.getAllByText(/최저가 3억 6,000만/)).toHaveLength(2);
    expect(
      screen.getAllByText(/감정가 5억 2,000만의 69% · 유찰 2회/),
    ).toHaveLength(2);
    expect(screen.getAllByText(/25.7평/).length).toBeGreaterThan(0);
    expect(screen.getByText("지분")).toBeTruthy();
    const q = lastQuery(auctions);
    expect(q).toMatchObject({
      bbox: BBOX,
      groups: ["apartment"],
      page: 1,
      pageSize: 50,
      sort: "sale_date",
    });
    expect(auctions.mock.calls.at(-1)![1]).toBeInstanceOf(AbortSignal);
  });

  it("줄을 누르면 그 경매를 onAuction으로 넘긴다", async () => {
    const { onAuction } = setup();
    fireEvent.click(await screen.findByText("테스트 물건 1"));
    expect(onAuction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "court:1" }),
    );
  });

  it("뒤로 가기를 누르면 onBack을 부른다", async () => {
    const { onBack } = setup();
    await screen.findByText("테스트 물건 1");
    fireEvent.click(screen.getByLabelText("뒤로 가기"));
    expect(onBack).toHaveBeenCalled();
  });

  it("실거래 비교가 있으면 줄에 보여주고 없으면 '실거래 비교 없음'을 쓴다", async () => {
    setup(async () => ({
      data: [
        row(1, { recent_trade_price: 520000000, recent_trade_count: 3 }),
        row(2, { recent_trade_price: null }),
      ],
      meta: meta(2),
    }));
    await screen.findByText("테스트 물건 1");
    expect(screen.getByText(/보다 31% 낮아요/)).toBeTruthy();
    expect(screen.getByText("실거래 비교 없음")).toBeTruthy();
  });

  it("complexId가 있으면 단지 이름으로 헤더를 쓰고 complex_id로 부른다", async () => {
    const { auctions } = setup(undefined, {
      complexId: "cx",
      name: "해운대아이파크",
    });
    await screen.findByText("테스트 물건 1");
    expect(screen.getByText("해운대아이파크")).toBeTruthy();
    const q = lastQuery(auctions);
    expect(q.complexId).toBe("cx");
    expect(q.bbox).toBeUndefined();
    expect(q.groups).toBeUndefined();
  });

  it("단지 이름이 없으면 '이 단지 경매'를 쓴다", async () => {
    setup(undefined, { complexId: "cx" });
    expect(await screen.findByText("이 단지 경매")).toBeTruthy();
  });

  it("유형 칩을 바꾸면 property_group을 바꿔 다시 부른다", async () => {
    const { auctions } = setup();
    await screen.findByText("테스트 물건 1");
    expect(lastQuery(auctions).groups).toEqual(["apartment"]);
    fireEvent.click(screen.getByRole("button", { name: "토지" }));
    await waitFor(() => expect(lastQuery(auctions).groups).toEqual(["land"]));
    expect(lastQuery(auctions).page).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    await waitFor(() => expect(lastQuery(auctions).groups).toBeUndefined());
  });

  it("필터 시트의 종류·끝난 경매 보기는 source·include_closed로 다시 부른다", async () => {
    const { auctions } = setup();
    await screen.findByText("테스트 물건 1");
    fireEvent.click(screen.getByRole("button", { name: /필터/ }));
    fireEvent.click(screen.getByRole("button", { name: "공매만" }));
    await waitFor(() => expect(lastQuery(auctions).source).toBe("public"));
    fireEvent.click(screen.getByRole("button", { name: "법원경매만" }));
    await waitFor(() => expect(lastQuery(auctions).source).toBe("court"));
    fireEvent.click(screen.getByRole("button", { name: "법원경매+공매" }));
    await waitFor(() => expect(lastQuery(auctions).source).toBeUndefined());
    fireEvent.click(screen.getByRole("switch", { name: "끝난 경매도 보기" }));
    await waitFor(() => expect(lastQuery(auctions).includeClosed).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(
      screen.queryByRole("switch", { name: "끝난 경매도 보기" }),
    ).toBeNull();
  });

  describe("서버 정렬", () => {
    it("정렬 칩은 sort로, 지분 물건 빼기는 exclude_share로 보낸다", async () => {
      const { auctions } = setup();
      await screen.findByText("테스트 물건 1");
      expect(lastQuery(auctions).excludeShare).toBeUndefined();
      fireEvent.click(
        screen.getByRole("button", { name: "감정가 대비 낮은 순" }),
      );
      await waitFor(() =>
        expect(lastQuery(auctions).sort).toBe("min_price_ratio"),
      );
      fireEvent.click(screen.getByRole("button", { name: "최저가 낮은 순" }));
      await waitFor(() => expect(lastQuery(auctions).sort).toBe("min_price"));
      fireEvent.click(screen.getByRole("button", { name: /필터/ }));
      fireEvent.click(screen.getByRole("switch", { name: "지분 물건 빼기" }));
      await waitFor(() => expect(lastQuery(auctions).excludeShare).toBe(true));
      expect(lastQuery(auctions).sort).toBe("min_price");
    });

    it("실거래 대비 순은 첫 쪽에 recent_trade_price 키가 있을 때만 보인다", async () => {
      setup(async () => ({ data: [withoutTrade(1)], meta: meta(1) }));
      await screen.findByText("테스트 물건 1");
      expect(
        screen.queryByRole("button", { name: "실거래 대비 많이 싼 순" }),
      ).toBeNull();
      cleanup();
      const { auctions } = setup(async () => ({
        data: [row(1, { recent_trade_price: null })],
        meta: meta(1),
      }));
      await screen.findByText("테스트 물건 1");
      fireEvent.click(
        screen.getByRole("button", { name: "실거래 대비 많이 싼 순" }),
      );
      await waitFor(() =>
        expect(lastQuery(auctions).sort).toBe("recent_trade_discount"),
      );
    });

    it("AUCTION_SERVER_SORT가 false면 정렬 칩과 지분 빼기를 보여주지 않고 sort도 보내지 않는다", async () => {
      flag.sort = false;
      const { auctions } = setup(async () => ({
        data: [row(1, { recent_trade_price: null })],
        meta: meta(1),
      }));
      await screen.findByText("테스트 물건 1");
      expect(
        screen.queryByRole("button", { name: "최저가 낮은 순" }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "실거래 대비 많이 싼 순" }),
      ).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /필터/ }));
      expect(
        screen.getByRole("switch", { name: "끝난 경매도 보기" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("switch", { name: "지분 물건 빼기" }),
      ).toBeNull();
      expect(lastQuery(auctions).sort).toBeUndefined();
      expect(lastQuery(auctions).excludeShare).toBeUndefined();
    });
  });

  describe("페이지", () => {
    const pages = async (q: any) => ({
      data: [row(q.page * 10), row(q.page * 10 + 1)],
      meta: meta(6, q.page, 3),
    });
    // jsdom에는 레이아웃이 없어 스크롤 위치를 직접 정해 준다.
    // RN Web은 스크롤 중에는 이벤트를 솎아 내므로(시계가 멈춰 있다) 이전 스크롤이 끝나길 기다린 뒤 보낸다.
    // 끝난 뒤에는 위치를 되돌려, 스크롤 종료 이벤트가 다시 끝으로 읽히지 않게 한다
    const scrollTo = async (top: number, height = 1000) => {
      await act(() => new Promise((r) => setTimeout(r, 130)));
      const list = screen.getByTestId("auction-list");
      Object.defineProperty(list, "scrollHeight", {
        value: height,
        configurable: true,
      });
      Object.defineProperty(list, "offsetHeight", {
        value: 600,
        configurable: true,
      });
      list.scrollTop = top;
      fireEvent.scroll(list);
      list.scrollTop = 0;
    };
    const scrollToEnd = () => scrollTo(400);

    it("끝까지 스크롤하면 다음 page를 부르고 total_pages에서 멈춘다", async () => {
      const { auctions } = setup(pages);
      await screen.findByText("테스트 물건 10");
      expect(auctions).toHaveBeenCalledTimes(1);
      await scrollToEnd();
      await screen.findByText("테스트 물건 20");
      expect(lastQuery(auctions).page).toBe(2);
      expect(screen.getByText("테스트 물건 10")).toBeTruthy();
      // 같은 스크롤에서 중복 요청이 나가지 않는다
      expect(auctions).toHaveBeenCalledTimes(2);
      await waitFor(() =>
        expect(screen.queryByText("정보를 불러오는 중…")).toBeNull(),
      );
      await scrollToEnd();
      await screen.findByText("테스트 물건 30");
      expect(lastQuery(auctions).page).toBe(3);
      await waitFor(() =>
        expect(screen.queryByText("정보를 불러오는 중…")).toBeNull(),
      );
      await scrollToEnd();
      await new Promise((r) => setTimeout(r, 20));
      expect(auctions).toHaveBeenCalledTimes(3);
    });

    it("끝에 닿지 않은 스크롤로는 다음 쪽을 부르지 않는다", async () => {
      const { auctions } = setup(pages);
      await screen.findByText("테스트 물건 10");
      await scrollTo(100, 5000);
      await new Promise((r) => setTimeout(r, 20));
      expect(auctions).toHaveBeenCalledTimes(1);
    });

    it("정렬을 바꾸면 1쪽부터 다시 불러 목록을 바꾼다", async () => {
      const { auctions } = setup(pages);
      await screen.findByText("테스트 물건 10");
      await scrollToEnd();
      await screen.findByText("테스트 물건 20");
      fireEvent.click(screen.getByRole("button", { name: "최저가 낮은 순" }));
      await waitFor(() => expect(lastQuery(auctions).page).toBe(1));
      await screen.findByText("테스트 물건 10");
      expect(screen.queryByText("테스트 물건 20")).toBeNull();
    });
  });

  describe("상태 안내", () => {
    it("빈 결과", async () => {
      setup(async () => ({ data: [], meta: meta(0) }));
      expect(
        await screen.findByText("이 화면 안에 진행 중인 경매가 없어요"),
      ).toBeTruthy();
    });

    it.each(["RESOURCE_NOT_FOUND", "DATA_NOT_READY"])(
      "%s는 준비 중 안내만 보여주고 다시 시도 버튼은 없다",
      async (code) => {
        setup(async () => {
          throw new ApiError("서버 메시지", code);
        });
        expect(
          await screen.findByText("경매 정보를 준비 중이에요"),
        ).toBeTruthy();
        expect(screen.queryByText("서버 메시지")).toBeNull();
        expect(screen.queryByText("다시 시도")).toBeNull();
      },
    );

    it("다른 오류는 메시지와 다시 시도를 보여주고 누르면 다시 부른다", async () => {
      let fail = true;
      const { auctions } = setup(async () => {
        if (fail) throw new ApiError("네트워크가 불안정해요");
        return { data: [row(1)], meta: meta(1) };
      });
      expect(await screen.findByText("네트워크가 불안정해요")).toBeTruthy();
      fail = false;
      fireEvent.click(screen.getByText("다시 시도"));
      expect(await screen.findByText("테스트 물건 1")).toBeTruthy();
      expect(auctions).toHaveBeenCalledTimes(2);
    });

    it("불러오는 동안에는 로딩을 보여준다", async () => {
      setup(() => new Promise(() => {}));
      expect(screen.getByText("정보를 불러오는 중…")).toBeTruthy();
      expect(
        within(screen.getByRole("heading")).getByText(/경매 물건/),
      ).toBeTruthy();
    });
  });
  it("목록 하단에 시트와 같은 형식의 출처 줄을 둔다", async () => {
    setup();
    expect(await screen.findByText("테스트 물건 1")).toBeTruthy();
    // AUCTION_META는 샘플 모드라 "샘플 데이터 · " 접두가 붙는다
    expect(
      screen.getByText(
        "샘플 데이터 · 출처: 대법원 법원경매정보 · 기준일 2026.10.05",
      ),
    ).toBeTruthy();
  });
});
