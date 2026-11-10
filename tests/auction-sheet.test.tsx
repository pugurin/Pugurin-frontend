import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Linking } from "react-native";
import { AuctionContent } from "../src/screens/AuctionContent";
import { ApiError } from "../src/api/client";
import { AUCTIONS, AUCTION_META } from "../src/api/fixtures";
import type { Repository } from "../src/api/repository";
import type { AuctionDetail } from "../src/api/types";
import type { SheetStage } from "../src/components/Sheet";

beforeEach(() => {
  // D-day 계산이 오늘 날짜에 기대므로 시계만 고정한다 (타이머는 그대로 둔다)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T10:00:00+09:00"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const base: AuctionDetail = {
  id: "court:2026타경1234",
  source: "court",
  case_no: "2026타경1234",
  court_name: "부산지방법원",
  title: null,
  usage: "아파트",
  property_group: "apartment",
  address: "부산광역시 해운대구 우동 1",
  lat: 35.16,
  lng: 129.16,
  location_precise: true,
  complex_id: null,
  appraisal_price: 520000000,
  min_price: 360000000,
  min_price_ratio: 69,
  deposit: 36000000,
  fail_count: 2,
  sale_date: "2026-11-14",
  bid_start_at: null,
  bid_end_at: null,
  land_area_m2: null,
  land_area_pyeong: null,
  building_area_m2: 84.97,
  building_area_pyeong: 25.7,
  is_share: false,
  status: "진행",
  is_closed: false,
  schedule: [
    {
      date: "2026-10-03",
      kind: "매각기일",
      min_price: 520000000,
      result: "유찰",
      sale_price: null,
    },
    {
      date: "2026-11-14",
      kind: "매각기일",
      min_price: 360000000,
      result: "예정",
      sale_price: null,
    },
  ],
  results: [],
};

function repoOf(data: AuctionDetail, meta = AUCTION_META) {
  return {
    mode: "api",
    auction: vi.fn(async () => ({ data, meta })),
  } as unknown as Repository;
}

function show(
  repo: Repository,
  stage: SheetStage = "peek",
  extra: {
    notify?: (m: string) => void;
    onStage?: (s: SheetStage) => void;
  } = {},
) {
  return render(
    <AuctionContent
      id="court:2026타경1234"
      repo={repo}
      stage={stage}
      onStage={extra.onStage ?? (() => {})}
      unit="평"
      notify={extra.notify ?? (() => {})}
    />,
  );
}

describe("경매 시트", () => {
  it("peek: 칩·제목·최저가·감정가 줄을 보여주고 실거래 비교가 없으면 그 줄을 숨긴다", async () => {
    show(repoOf(base));
    await waitFor(() =>
      expect(screen.getByText("최저가 3억 6,000만")).toBeTruthy(),
    );
    expect(screen.getByText("법원경매")).toBeTruthy();
    expect(screen.getByText("입찰 D-12")).toBeTruthy();
    expect(screen.getByText("해운대구 우동 1")).toBeTruthy();
    expect(screen.getByText("아파트 · 25.7평")).toBeTruthy();
    expect(
      screen.getByText("감정가 5억 2,000만의 69% · 유찰 2회"),
    ).toBeTruthy();
    expect(screen.queryByText(/실거래/)).toBeNull();
    expect(screen.queryByText("진행 이력")).toBeNull();
    expect(
      screen.getByText(/위로 올리면 경매 정보를 더 볼 수 있어요/),
    ).toBeTruthy();
  });

  it("peek의 안내 줄을 누르면 반 단계로 올린다", async () => {
    const onStage = vi.fn();
    show(repoOf(base), "peek", { onStage });
    fireEvent.click(await screen.findByText(/위로 올리면/));
    expect(onStage).toHaveBeenCalledWith("half");
  });

  it("제목이 있으면 그것을 쓰고, 7일 이내 D-day는 빨간 칩이다", async () => {
    show(
      repoOf({ ...base, title: "우동 아파트 84㎡", sale_date: "2026-11-05" }),
    );
    expect(await screen.findByText("우동 아파트 84㎡")).toBeTruthy();
    const chip = screen.getByText("입찰 D-3");
    expect(getComputedStyle(chip).color).toBe("rgb(131, 26, 20)");
  });

  it("지분 물건은 '지분' 칩, 공매는 '공매' 칩과 입찰 기간을 보여준다", async () => {
    show(
      repoOf({
        ...base,
        source: "public",
        court_name: null,
        is_share: true,
        bid_start_at: "2026-11-30T10:00:00+09:00",
        bid_end_at: "2026-12-03T17:00:00+09:00",
        sale_date: "2026-12-03",
      }),
      "full",
    );
    expect(await screen.findByText("공매")).toBeTruthy();
    const share = screen.getByText("지분");
    // 전역 제약의 노란 칩 색 (#FFF3D6 / #8A5E08)
    expect(getComputedStyle(share).color).toBe("rgb(138, 94, 8)");
    expect(getComputedStyle(share.parentElement!).backgroundColor).toBe(
      "rgb(255, 243, 214)",
    );
    expect(screen.queryByText("법원경매")).toBeNull();
    expect(screen.getByText("입찰 D-31")).toBeTruthy();
    expect(screen.getByText("입찰 기간")).toBeTruthy();
    expect(
      screen.getByText("2026.11.30 10:00 ~ 2026.12.03 17:00"),
    ).toBeTruthy();
  });

  it("full: 가격 비교·진행 이력·물건 정보·권리관계 안내·출처를 보여준다", async () => {
    show(
      repoOf({
        ...base,
        results: [
          { date: "2026-10-03", result: "유찰", bidders: 0, top_price: null },
        ],
      }),
      "full",
    );
    await screen.findByText("진행 이력");
    expect(screen.getByText("가격 비교")).toBeTruthy();
    expect(screen.getByText("감정가")).toBeTruthy();
    expect(screen.getByText("최저가")).toBeTruthy();
    // 진행 이력: 날짜순, 날짜·kind·최저가·결과
    const rows = screen.getAllByText(/^매각기일/);
    expect(rows).toHaveLength(2);
    expect(screen.getByText("2026.10.03")).toBeTruthy();
    expect(screen.getByText("2026.11.14")).toBeTruthy();
    expect(screen.getByText("유찰")).toBeTruthy();
    expect(screen.getByText("예정")).toBeTruthy();
    expect(screen.getByText(/입찰 0명/)).toBeTruthy();
    // 물건 정보
    expect(screen.getByText("사건번호")).toBeTruthy();
    expect(screen.getByText("2026타경1234")).toBeTruthy();
    expect(screen.getByText("부산지방법원")).toBeTruthy();
    expect(screen.getByText("입찰보증금")).toBeTruthy();
    expect(screen.getByText("3,600만")).toBeTruthy();
    expect(screen.getByText("진행 상태")).toBeTruthy();
    // 안내·원문·출처
    expect(
      screen.getByText(
        "임차인·선순위 권리 같은 권리관계는 퍼구린이 확인하지 않아요. 입찰 전에 법원 문서를 꼭 확인하세요.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("법원경매정보 열기 ↗")).toBeTruthy();
    expect(
      screen.getByText("사건번호로 검색하면 원문을 볼 수 있어요"),
    ).toBeTruthy();
    expect(screen.getByText(/출처: 대법원 법원경매정보/)).toBeTruthy();
    expect(screen.getByText(/기준일 2026\.10\.05/)).toBeTruthy();
  });

  it("다가오는 기일 줄만 강조한다", async () => {
    show(repoOf(base), "half");
    await screen.findByText("진행 이력");
    expect(screen.queryAllByLabelText("다가오는 기일")).toHaveLength(1);
  });

  it("원문 버튼은 source_url을 연다", async () => {
    const open = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    show(repoOf(base), "full");
    fireEvent.click(await screen.findByText("법원경매정보 열기 ↗"));
    expect(open).toHaveBeenCalledWith("https://www.courtauction.go.kr/");
  });

  it("웹에서는 사건번호 복사 버튼이 클립보드에 쓰고 알려 준다", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const notify = vi.fn();
    show(repoOf(base), "full", { notify });
    fireEvent.click(await screen.findByText("사건번호 복사"));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("사건번호를 복사했어요"),
    );
    expect(writeText).toHaveBeenCalledWith("2026타경1234");
    vi.unstubAllGlobals();
  });

  it("원문 주소가 없어도 사건번호 복사 버튼은 따로 보인다", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    try {
      const { source_url: _, ...noUrl } = AUCTION_META;
      show(repoOf(base, noUrl), "full");
      fireEvent.click(await screen.findByText("사건번호 복사"));
      expect(writeText).toHaveBeenCalledWith("2026타경1234");
      expect(screen.queryByText("법원경매정보 열기 ↗")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("클립보드를 쓸 수 없으면 복사 버튼을 두지 않는다", async () => {
    show(repoOf(base), "full");
    await screen.findByText("진행 이력");
    expect(screen.queryByText("사건번호 복사")).toBeNull();
  });

  it("실거래 비교값이 있으면 비교 줄과 실거래 막대를 보여준다", async () => {
    show(
      repoOf({
        ...base,
        recent_trade_price: 450000000,
        recent_trade_count: 4,
      }),
      "full",
    );
    expect(
      await screen.findByText("같은 평형 최근 실거래(4.5억)보다 20% 낮아요"),
    ).toBeTruthy();
    expect(screen.getByText("최근 실거래")).toBeTruthy();
  });

  it("같은 평형 평균가가 있으면 평균과 공급 평형으로 견준다", async () => {
    show(
      repoOf({
        ...base,
        recent_trade_price: 400000000,
        recent_trade_count: 4,
        recent_trade_avg_price: 450000000,
        recent_trade_supply_area_pyeong: 34,
      }),
      "full",
    );
    expect(
      await screen.findByText("같은 평형 평균 실거래(4.5억)보다 20% 낮아요"),
    ).toBeTruthy();
    expect(screen.getByText("같은 평형 평균 (34평형)")).toBeTruthy();
    expect(screen.getByText("4억 5,000만")).toBeTruthy();
    expect(screen.queryByText("최근 실거래")).toBeNull();
  });

  it("공급 평형이 없으면 평형 없이 '같은 평형 평균'", async () => {
    show(
      repoOf({
        ...base,
        recent_trade_price: 400000000,
        recent_trade_count: 4,
        recent_trade_avg_price: 450000000,
        recent_trade_supply_area_pyeong: null,
      }),
      "full",
    );
    expect(await screen.findByText("같은 평형 평균")).toBeTruthy();
  });

  it("location_precise가 false면 '지도 위치는 대략적이에요'", async () => {
    show(repoOf({ ...base, location_precise: false }));
    expect(await screen.findByText("지도 위치는 대략적이에요")).toBeTruthy();
  });

  it("끝난 경매는 '끝난 경매' 칩을 쓰고 D-day를 숨긴다", async () => {
    show(repoOf({ ...base, is_closed: true, status: "낙찰" }));
    expect(await screen.findByText("끝난 경매")).toBeTruthy();
    expect(screen.queryByText(/입찰 D-/)).toBeNull();
  });

  it("건물면적이 없으면 토지면적을 쓰고 ㎡ 단위를 따른다", async () => {
    const data = {
      ...base,
      building_area_m2: null,
      building_area_pyeong: null,
      land_area_m2: 132.2,
      land_area_pyeong: 40,
    };
    render(
      <AuctionContent
        id={data.id}
        repo={repoOf(data)}
        stage="peek"
        onStage={() => {}}
        unit="㎡"
        notify={() => {}}
      />,
    );
    expect(await screen.findByText("아파트 · 132.2㎡")).toBeTruthy();
  });

  it("불러오기 실패 시 오류 카드와 다시 시도를 보여준다", async () => {
    const auction = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError("경매 정보를 불러오지 못했어요", "NETWORK"),
      )
      .mockResolvedValue({ data: base, meta: AUCTION_META });
    show({ mode: "api", auction } as unknown as Repository);
    expect(
      await screen.findByText("경매 정보를 불러오지 못했어요"),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("다시 시도"));
    expect(await screen.findByText("최저가 3억 6,000만")).toBeTruthy();
    expect(auction).toHaveBeenCalledTimes(2);
  });

  it("샘플 물건도 그대로 그린다", async () => {
    const sample = AUCTIONS[0];
    render(
      <AuctionContent
        id={sample.id}
        repo={repoOf(sample)}
        stage="full"
        onStage={() => {}}
        unit="평"
        notify={() => {}}
      />,
    );
    expect(await screen.findByText("해운대아이파크 84㎡")).toBeTruthy();
    expect(screen.getByText("최근 실거래")).toBeTruthy();
  });
});
