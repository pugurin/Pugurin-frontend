import { describe, it, expect } from "vitest";
import { auctionItems, markerItems, markerLines } from "../src/map/markers";
import type { Auction, ComplexMarker, RegionMarker } from "../src/api/types";

const region: RegionMarker = {
  kind: "region",
  region_code: "2635010500",
  name: "우동",
  lat: 35.16,
  lng: 129.16,
  transaction_count: 1280,
  summary: { median_price_per_pyeong: 32000000 },
};
const complex = (latest: Partial<ComplexMarker["latest"]>): ComplexMarker => ({
  kind: "complex",
  complex_id: "c1",
  name: "해운대아이파크",
  lat: 35.15,
  lng: 129.14,
  transaction_count: 21,
  latest: {
    deal_type: "sale",
    price: 1450000000,
    exclusive_area_pyeong: 25.7,
    supply_area_pyeong: 34,
    contract_date: "2026-08-14",
    ...latest,
  },
});

describe("마커 글자", () => {
  it("구·동 마커는 지역명 / 평당가 / 건수", () => {
    expect(markerLines(region, "평")).toEqual({
      title: "우동",
      amount: "평당 3,200만",
      sub: "1,280건",
    });
  });
  it("월세 구·동 마커는 보증금·월세 중위값", () => {
    const m = { ...region, summary: { median_deposit: 50000000, median_monthly_rent: 800000 } };
    expect(markerLines(m, "평").amount).toBe("보증금 5,000 · 월 80");
  });
  it("단지 매매는 금액 / 공급 평형 · 계약월", () => {
    expect(markerLines(complex({}), "평")).toMatchObject({ amount: "14.5억", sub: "34평 · '26.08" });
  });
  it("공급 평형이 없으면 전용임을 밝힌다", () => {
    expect(markerLines(complex({ supply_area_pyeong: null }), "평").sub).toBe("전용 25.7평 · '26.08");
  });
  it("전세·월세 단지 표기", () => {
    expect(markerLines(complex({ deal_type: "jeonse", price: null, deposit: 500000000 }), "평").amount).toBe("전세 5억");
    expect(
      markerLines(complex({ deal_type: "monthly", price: null, deposit: 50000000, monthly_rent: 800000 }), "평").amount,
    ).toBe("5,000/80");
  });
  it("㎡ 단위로 바꿔 표시한다", () => {
    expect(markerLines(complex({}), "㎡").sub).toBe("112.4㎡ · '26.08");
  });
});

describe("런타임에 넘기는 마커", () => {
  it("선택된 마커는 먹색과 가장 높은 우선순위를 가진다", () => {
    const [r, c] = markerItems([region, complex({})], "apartment", "평", "c1");
    expect(c).toMatchObject({ id: "c1", color: "#111110", rank: 0, lat: 35.15, lng: 129.14, amount: "14.5억" });
    expect(r).toMatchObject({ color: "#3E64A0", region: true, rank: 1, title: "우동" });
  });
  it("거래가 많은 단지가 먼저 자리를 잡는다", () => {
    const [many, few] = markerItems(
      [complex({}), { ...complex({}), complex_id: "c2", transaction_count: 1 }],
      "villa",
      "평",
      null,
    );
    expect(many.rank).toBeLessThan(few.rank);
    expect(many.color).toBe("#B0506B");
  });
});

const today = new Date("2026-11-02T00:00:00+09:00");
const a1: Auction = {
  id: "a1",
  source: "court",
  case_no: "2026타경1234",
  court_name: "부산지방법원",
  title: null,
  usage: "아파트",
  property_group: "apartment",
  address: "부산광역시 해운대구 우동 1",
  lat: 35.15,
  lng: 129.14,
  location_precise: true,
  complex_id: "c1",
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
const a2: Auction = { ...a1, id: "a2", complex_id: null, lat: 35.2, lng: 129.2 };
const complexMarker = (id: string) => ({ ...complex({}), complex_id: id });

describe("경매 마커", () => {
  it("경매는 흰 바탕 변형으로, 좌표 없는 물건은 빼고 만든다", () => {
    const items = auctionItems(
      [{ ...a1, complex_id: null }, { ...a2, lat: null, lng: null }],
      [],
      null,
      today,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "auction:a1",
      auction: true,
      amount: "⚖ 3.6억",
      sub: "감정가의 69%",
      color: "#B02A22",
      lat: 35.15,
      lng: 129.14,
    });
    expect(items[0].attach).toBeUndefined();
  });
  it("단지 마커가 있으면 그 옆에 붙인다", () => {
    const [item] = auctionItems([a1], [complexMarker("c1")], null, today);
    expect(item).toMatchObject({ id: "auction:a1", attach: "c1", amount: "⚖ 3.6억" });
  });
  it("단지 마커가 없으면 단지가 같아도 건별로 자기 좌표에 둔다", () => {
    const items = auctionItems([a1, { ...a1, id: "a3" }], [complexMarker("c9")], null, today);
    expect(items.map((i) => i.id)).toEqual(["auction:a1", "auction:a3"]);
    expect(items.every((i) => i.attach === undefined)).toBe(true);
  });
  it("단지 마커가 있으면 그 옆에 붙이고, 같은 단지 여러 건은 하나로 합친다", () => {
    const items = auctionItems(
      [a1, { ...a1, id: "a3", min_price: 300000000 }],
      [complexMarker("c1")],
      null,
      today,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "auction-group:c1",
      auction: true,
      attach: "c1",
      amount: "⚖ 2건",
      sub: "최저 3억",
      lat: 35.15,
      lng: 129.14,
    });
  });
  it("묶음을 선택하면 먹색과 가장 높은 우선순위를 가진다", () => {
    const [g] = auctionItems([a1, { ...a1, id: "a3" }], [complexMarker("c1")], "auction-group:c1", today);
    expect(g).toMatchObject({ color: "#111110", rank: 0 });
  });
  it("선택된 경매는 먹색과 가장 높은 우선순위를 가진다", () => {
    const [a] = auctionItems([a1], [], "auction:a1", today);
    expect(a).toMatchObject({ color: "#111110", rank: 0 });
  });
  it("경매는 실거래보다 뒤에 자리를 잡는다", () => {
    expect(auctionItems([a1], [], null, today)[0].rank).toBeGreaterThan(3);
  });
});
