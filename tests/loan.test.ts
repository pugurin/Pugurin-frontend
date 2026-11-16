import { describe, expect, it } from "vitest";
import {
  calcLoan,
  maxLtv,
  monthlyPayment,
  snapAssets,
  type LoanCriteria,
} from "../src/state/loan";

const base: LoanCriteria = { regulated: false, homes: "none", firstTime: false };

describe("maxLtv", () => {
  it("비규제 무주택 70%, 규제 무주택 40%", () => {
    expect(maxLtv(base)).toBe(70);
    expect(maxLtv({ ...base, regulated: true })).toBe(40);
  });
  it("생애최초는 우대하되 무주택일 때만", () => {
    expect(maxLtv({ ...base, firstTime: true })).toBe(80);
    expect(maxLtv({ ...base, regulated: true, firstTime: true })).toBe(70);
    expect(maxLtv({ ...base, homes: "one", firstTime: true })).toBe(60);
  });
  it("규제지역 다주택은 대출 불가(0%)", () => {
    expect(maxLtv({ ...base, homes: "multi", regulated: true })).toBe(0);
    expect(maxLtv({ ...base, homes: "multi" })).toBe(60);
  });
});

describe("monthlyPayment", () => {
  it("원리금균등: 3억 · 연 4% · 30년 ≈ 143만 원", () => {
    expect(Math.round(monthlyPayment(3e8, 4, 30))).toBe(1432246);
  });
  it("금리 0이면 원금만 나눈다", () => {
    expect(monthlyPayment(1.2e8, 0, 10)).toBe(1e6);
  });
  it("대출 0원이면 0원", () => {
    expect(monthlyPayment(0, 4, 30)).toBe(0);
  });
  it("기간이 길수록 월납입금이 줄어든다", () => {
    const m30 = monthlyPayment(3e8, 4, 30);
    const m50 = monthlyPayment(3e8, 4, 50);
    expect(m50).toBeLessThan(m30);
  });
});

describe("calcLoan", () => {
  it("한도 안이면 가능, 필요한 만큼만 빌린다", () => {
    const r = calcLoan({ price: 5e8, assets: 2e8, criteria: base, rate: 4, years: 30 });
    expect(r).toMatchObject({ ltv: 70, limit: 3.5e8, needed: 3e8, ok: true, loan: 3e8, shortfall: 0 });
    expect(Math.round(r.monthly)).toBe(1432246);
  });
  it("한도를 넘으면 불가, 모자란 자산을 알려 준다", () => {
    const r = calcLoan({ price: 5e8, assets: 1e8, criteria: base, rate: 4, years: 30 });
    expect(r).toMatchObject({ ok: false, needed: 4e8, limit: 3.5e8, shortfall: 5e7, loan: 3.5e8 });
  });
  it("자산이 매매가 이상이면 대출 없이 가능", () => {
    const r = calcLoan({ price: 5e8, assets: 6e8, criteria: base, rate: 4, years: 30 });
    expect(r).toMatchObject({ ok: true, needed: 0, loan: 0, monthly: 0 });
  });
  it("LTV 0%면 자산이 모자랄 때 불가", () => {
    const r = calcLoan({
      price: 5e8,
      assets: 4e8,
      criteria: { ...base, homes: "multi", regulated: true },
      rate: 4,
      years: 30,
    });
    expect(r).toMatchObject({ ok: false, limit: 0, loan: 0, shortfall: 1e8 });
  });
});

describe("snapAssets", () => {
  it("1천만 원 단위로 맞추고 0~매매가로 자른다", () => {
    expect(snapAssets(123_456_789, 5e8)).toBe(1.2e8);
    expect(snapAssets(-5, 5e8)).toBe(0);
    expect(snapAssets(9e8, 5e8)).toBe(5e8);
  });
});
