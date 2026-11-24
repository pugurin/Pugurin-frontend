import { describe, expect, it } from "vitest";
import type { InterestReportComplex } from "../src/api/types";
import { lineDepths } from "../src/screens/NotificationsScreen";

type Auction = InterestReportComplex["auctions"][number];

const area = (label: string) => ({
  area_bucket: 0,
  area_label: label,
  count: 1,
  latest: { price: 900_000_000, contract_date: "2026-11-02" },
  prev_diff: null,
});
const auction = (over: Partial<Auction> = {}): Auction => ({
  id: "court:x",
  area_label: "34평형",
  min_price: 640_000_000,
  date: "2026-12-10",
  source: "court",
  ...over,
});
// 내용을 하나도 모르는 경매. 서버는 건별 줄을 만들지 않고 머리줄 건수로만 센다
const unknown = () =>
  auction({ area_label: null, min_price: null, date: null });
const redev = {
  id: "r1",
  area_name: "삼익비치구역",
  kind: "reconstruction",
  previous_stage: null,
  stage: "project_approved",
} as InterestReportComplex["redevelopments"][number];

function complex(
  over: Partial<InterestReportComplex> & { lines: string[] },
): InterestReportComplex {
  return {
    id: "c1",
    name: "가람단지",
    sigungu_name: null,
    dong_name: null,
    lat: null,
    lng: null,
    sales: { count: 0, areas: [], more_areas: 0 },
    auctions: [],
    redevelopments: [],
    ...over,
  };
}

describe("리포트 줄 들여쓰기(lineDepths)", () => {
  it("새 실거래 머리줄 뒤 평형 줄은 딸린 줄(–)", () => {
    const b = complex({
      lines: [
        "새 실거래 2건",
        "34평형 1건: 9억 (11/02)",
        "25평형 1건: 9억 (11/02)",
      ],
      sales: {
        count: 2,
        areas: [area("34평형"), area("25평형")],
        more_areas: 0,
      },
    });
    expect(lineDepths(b)).toEqual([0, 1, 1]);
  });

  it("외 N개 평형도 딸린 줄이고, 정비사업은 머리줄", () => {
    const b = complex({
      lines: [
        "새 실거래 4건",
        "a",
        "b",
        "c",
        "외 1개 평형",
        "구역: 단계가 됐어요",
      ],
      sales: {
        count: 4,
        areas: [area("a"), area("b"), area("c")],
        more_areas: 1,
      },
      redevelopments: [redev],
    });
    expect(lineDepths(b)).toEqual([0, 1, 1, 1, 1, 0]);
  });

  it("경매 1건은 머리줄 한 줄", () => {
    const b = complex({
      lines: ["새 경매 1건: 34평형 · 최저가 6.4억 · 매각기일 12/10"],
      auctions: [auction()],
    });
    expect(lineDepths(b)).toEqual([0]);
  });

  it("경매 여러 건은 머리줄 + 건마다 딸린 줄", () => {
    const b = complex({
      lines: [
        "새 실거래 1건",
        "34평형 1건: 9억 (11/02)",
        "새 경매 2건",
        "x",
        "y",
      ],
      sales: { count: 1, areas: [area("34평형")], more_areas: 0 },
      auctions: [auction(), auction({ id: "public:y", source: "public" })],
    });
    expect(lineDepths(b)).toEqual([0, 1, 0, 1, 1]);
  });

  it("내용을 모르는 경매가 섞여도 서버처럼 그 건의 줄을 빼고 맞춘다", () => {
    const b = complex({
      lines: [
        "새 경매 3건",
        "34평형 · 최저가 6.4억",
        "52평형",
        "구역: 단계가 됐어요",
      ],
      auctions: [auction(), unknown(), auction({ area_label: "52평형" })],
      redevelopments: [redev],
    });
    expect(lineDepths(b)).toEqual([0, 1, 1, 0]);
  });

  it("내용을 모르는 경매 1건은 '새 경매 1건' 한 줄", () => {
    const b = complex({ lines: ["새 경매 1건"], auctions: [unknown()] });
    expect(lineDepths(b)).toEqual([0]);
  });

  it("줄 수가 구조화 필드와 맞지 않으면 모두 머리줄(•)", () => {
    const b = complex({
      lines: ["새 경매 2건", "x", "y", "예상 못 한 줄"],
      auctions: [auction(), auction()],
    });
    expect(lineDepths(b)).toEqual([0, 0, 0, 0]);
  });
});
