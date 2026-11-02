import { describe, expect, it } from "vitest";
import type { Auction } from "../src/api/types";
import {
  AUCTION_MIN_ZOOM,
  AUCTION_SERVER_SORT,
  auctionAmount,
  auctionSub,
  auctionTitle,
  compareLine,
  dday,
  ddayDate,
  formatWon,
  ratioLine,
} from "../src/state/auction";

const today = new Date("2026-11-02T00:00:00+09:00");

const base: Auction = {
  id: "a1",
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
  deposit: null,
  fail_count: 1,
  sale_date: "2026-11-14",
  bid_start_at: null,
  bid_end_at: null,
  land_area_m2: null,
  land_area_pyeong: null,
  building_area_m2: null,
  building_area_pyeong: null,
  is_share: false,
  status: null,
  is_closed: false,
};

describe("경매 문구 함수", () => {
  it("상수", () => {
    expect(AUCTION_MIN_ZOOM).toBe(14);
    expect(AUCTION_SERVER_SORT).toBe(true);
  });

  it("formatWon은 만 단위로 반올림해 억·만을 이어 쓴다", () => {
    expect(formatWon(520000000)).toBe("5억 2,000만");
    expect(formatWon(360000000)).toBe("3억 6,000만");
    expect(formatWon(300000000)).toBe("3억");
    expect(formatWon(90000000)).toBe("9,000만");
    expect(formatWon(1234500000)).toBe("12억 3,450만");
    expect(formatWon(1234560000)).toBe("12억 3,456만");
  });

  it("D-day", () => {
    expect(dday(base, today)).toEqual({ label: "D-12", soon: false });
    expect(dday({ ...base, sale_date: "2026-11-05" }, today)).toEqual({
      label: "D-3",
      soon: true,
    });
    expect(dday({ ...base, sale_date: "2026-11-09" }, today)?.soon).toBe(true);
    expect(dday({ ...base, sale_date: "2026-11-10" }, today)?.soon).toBe(false);
    expect(dday({ ...base, sale_date: "2026-11-02" }, today)?.label).toBe(
      "D-DAY",
    );
    expect(dday({ ...base, sale_date: "2026-10-30" }, today)).toBeNull();
    expect(dday({ ...base, is_closed: true }, today)).toBeNull();
    expect(dday({ ...base, sale_date: null }, today)).toBeNull();
  });

  it("D-day는 한국 날짜 기준이라 기계 시간대와 무관하다", () => {
    // UTC로는 11-01 16:00이지만 한국은 11-02 01:00
    const early = new Date("2026-11-01T16:00:00Z");
    expect(dday({ ...base, sale_date: "2026-11-02" }, early)?.label).toBe(
      "D-DAY",
    );
    // 공매 마감 시각(UTC 표기)도 한국 날짜로 센다: 11-05 23:30 KST = 11-05 14:30Z
    expect(
      dday(
        { ...base, source: "public", bid_end_at: "2026-11-05T14:30:00Z" },
        today,
      )?.label,
    ).toBe("D-3");
    // 11-05 15:30Z는 한국 11-06 00:30
    expect(
      dday(
        { ...base, source: "public", bid_end_at: "2026-11-05T15:30:00Z" },
        today,
      )?.label,
    ).toBe("D-4");
  });

  it("ddayDate", () => {
    expect(ddayDate(base)).toBe("2026-11-14");
    expect(
      ddayDate({
        ...base,
        source: "public",
        bid_end_at: "2026-11-20T18:00:00+09:00",
      }),
    ).toBe("2026-11-20T18:00:00+09:00");
    expect(ddayDate({ ...base, source: "public", bid_end_at: null })).toBe(
      "2026-11-14",
    );
    expect(ddayDate({ ...base, bid_end_at: "2026-11-20T18:00:00+09:00" })).toBe(
      "2026-11-14",
    );
  });

  it("감정가 대비 문구", () => {
    expect(ratioLine(base)).toBe("감정가 5억 2,000만의 69%");
    expect(ratioLine({ ...base, min_price_ratio: null })).toBeNull();
    expect(ratioLine({ ...base, appraisal_price: null })).toBeNull();
  });

  it("금액", () => {
    expect(auctionAmount(base)).toBe("⚖ 3.6억");
    expect(auctionAmount({ ...base, min_price: null })).toBe("⚖ 최저가 미정");
  });

  it("sub 문구 우선순위", () => {
    const noRatio = { ...base, min_price_ratio: null };
    expect(auctionSub(base, today)).toBe("감정가의 69%");
    expect(auctionSub(noRatio, today)).toBe("D-12");
    expect(auctionSub({ ...noRatio, is_closed: true }, today)).toBe("");
  });

  it("실거래 비교", () => {
    const t = { ...base, recent_trade_price: 520000000, recent_trade_count: 4 };
    expect(compareLine(t)).toEqual({
      text: "같은 평형 최근 실거래(5.2억)보다 31% 낮아요",
      good: true,
    });
    expect(auctionSub(t, today)).toBe("실거래보다 31%↓");
    expect(compareLine({ ...t, recent_trade_count: 1 })?.text).toBe(
      "최근 거래 1건(5.2억)보다 31% 낮아요",
    );
    expect(compareLine({ ...t, recent_trade_price: 300000000 })).toEqual({
      text: "최근 실거래(3억)보다 20% 높아요",
      good: false,
    });
    expect(compareLine({ ...base, recent_trade_price: null })).toBeNull();
    expect(compareLine({ ...t, min_price: null })).toBeNull();
  });

  it("제목", () => {
    expect(
      auctionTitle({
        ...base,
        title: null,
        address: "부산광역시 해운대구 우동 1",
      }),
    ).toBe("해운대구 우동 1");
    expect(
      auctionTitle({ ...base, title: "부산광역시 남구 대연동 샘플아파트" }),
    ).toBe("남구 대연동 샘플아파트");
  });
});
