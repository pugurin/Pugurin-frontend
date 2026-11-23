import { describe, it, expect, vi } from "vitest";
import {
  areaAverage,
  averageLabel,
  monthsAgo,
  recentComplexTransactions,
} from "../src/state/areaAverage";

const tx = (o: Record<string, unknown>) =>
  ({
    exclusive_area_m2: 84.97,
    deal_type: "sale",
    price: 5e8,
    deposit: null,
    monthly_rent: null,
    contract_date: "2026-10-01",
    is_cancelled: false,
    ...o,
  }) as any;

describe("평형별 최근 1년 평균가", () => {
  const since = "2025-11-23";
  it("같은 평형(전용 ㎡ 반올림이 같은 것)의 기간 안 거래만 평균낸다", () => {
    const list = [
      tx({ price: 5e8 }),
      tx({ price: 7e8, exclusive_area_m2: 84.6 }),
      tx({ price: 9e8, exclusive_area_m2: 114.9 }), // 다른 평형
      tx({ price: 1e8, contract_date: "2025-11-22" }), // 기간 밖
      tx({ price: 1e8, is_cancelled: true }), // 해제
    ];
    expect(areaAverage(list, 84.97, since)).toEqual({
      count: 2,
      price: 6e8,
      deposit: null,
      monthly_rent: null,
    });
  });
  it("월세는 보증금과 월세를 따로 평균낸다", () => {
    const list = [
      tx({
        deal_type: "monthly",
        price: null,
        deposit: 1e7,
        monthly_rent: 5e5,
      }),
      tx({
        deal_type: "monthly",
        price: null,
        deposit: 3e7,
        monthly_rent: 7e5,
      }),
    ];
    expect(areaAverage(list, 84.97, since)).toMatchObject({
      count: 2,
      deposit: 2e7,
      monthly_rent: 6e5,
    });
  });
  it("거래가 없으면 null", () => {
    expect(areaAverage([], 84.97, since)).toBeNull();
  });
  it("평균 문구는 거래 유형에 맞춰 적는다", () => {
    expect(
      averageLabel("sale", {
        count: 3,
        price: 323456789,
        deposit: null,
        monthly_rent: null,
      }),
    ).toBe("평균 매매가 3.2억 · 거래 3건");
    expect(
      averageLabel("jeonse", {
        count: 1,
        price: null,
        deposit: 2e8,
        monthly_rent: null,
      }),
    ).toBe("평균 전세가 2억 · 거래 1건");
    expect(
      averageLabel("monthly", {
        count: 2,
        price: null,
        deposit: 2e7,
        monthly_rent: 6e5,
      }),
    ).toBe("평균 월세 2,000/60 · 거래 2건");
  });
  it("12개월 전 날짜", () => {
    expect(monthsAgo(12, new Date(2026, 10, 23))).toBe("2025-11-23");
  });
});

describe("단지 최근 거래 모으기", () => {
  const page = (dates: string[], p: number, totalPages: number) => ({
    data: dates.map((d) => tx({ contract_date: d })),
    meta: { page: p, total_pages: totalPages },
  });
  it("100건씩 받다가 기간 밖 거래가 나오면 멈춘다", async () => {
    const transactions = vi
      .fn()
      .mockResolvedValueOnce(page(["2026-10-01", "2026-05-01"], 1, 3))
      .mockResolvedValueOnce(page(["2026-01-01", "2025-10-01"], 2, 3));
    const repo: any = { transactions };
    const list = await recentComplexTransactions(
      repo,
      { deal_type: "sale" } as any,
      "c",
      "2025-11-23",
    );
    expect(list).toHaveLength(4);
    expect(transactions).toHaveBeenCalledTimes(2);
    expect(transactions.mock.calls[0][1]).toMatchObject({
      complexId: "c",
      page: 1,
      pageSize: 100,
      cancelled: false,
    });
  });
  it("마지막 페이지에서 멈춘다", async () => {
    const transactions = vi
      .fn()
      .mockResolvedValueOnce(page(["2026-10-01"], 1, 1));
    await recentComplexTransactions(
      { transactions } as any,
      { deal_type: "sale" } as any,
      "c",
      "2025-11-23",
    );
    expect(transactions).toHaveBeenCalledTimes(1);
  });
});
