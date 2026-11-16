// 단지 상세 대출 계산기 (#143). 화면과 떨어진 순수 계산만 둔다.
import type { Transaction } from "../api/types";

// LTV 표와 예시 금리는 확정 전 임시값이다. 기획·백엔드와 맞추며 이 파일만 고친다.

export type Homes = "none" | "one" | "multi";

export type LoanCriteria = {
  // 규제지역(투기과열지구·조정대상지역 등). 백엔드가 주기 전에는 사용자가 직접 고른다
  regulated: boolean;
  homes: Homes;
  // 생애최초 주택 구입. 무주택일 때만 적용한다
  firstTime: boolean;
};

export const HOMES: Record<Homes, string> = {
  none: "무주택",
  one: "1주택",
  multi: "다주택",
};

// 최대 LTV(%). [비규제, 규제]
// - 비규제 60~70%, 규제 무주택 40~50%, 생애최초 70~80%, 규제지역 다주택 0%
// - 1주택은 기존 주택 처분 조건을 전제로 한다
export const LTV_TABLE: Record<Homes | "firstTime", [number, number]> = {
  firstTime: [80, 70],
  none: [70, 40],
  one: [60, 40],
  multi: [60, 0],
};

export function maxLtv(c: LoanCriteria): number {
  const key = c.homes === "none" && c.firstTime ? "firstTime" : c.homes;
  return LTV_TABLE[key][c.regulated ? 1 : 0];
}

// 기간별 연 금리(%). 백엔드가 은행 금리를 주기 전까지 쓰는 예시값
export const LOAN_TERMS = [30, 40, 50] as const;
export type LoanTerm = (typeof LOAN_TERMS)[number];
export type LoanRates = Record<LoanTerm, number>;
export const SAMPLE_RATES: LoanRates = { 30: 4.0, 40: 4.1, 50: 4.2 };

// 원리금균등상환 월납입금(원). 금리 0이면 원금만 나눈다
export function monthlyPayment(
  principal: number,
  annualRatePct: number,
  years: number,
): number {
  if (principal <= 0 || years <= 0) return 0;
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export type LoanResult = {
  ltv: number;
  // LTV로 받을 수 있는 최대 대출액
  limit: number;
  // 매매가 - 내 자산
  needed: number;
  // 필요 대출이 한도 안이면 true. 필요 대출이 0이면 대출 없이 살 수 있다
  ok: boolean;
  // 한도를 넘을 때 더 있어야 하는 자산
  shortfall: number;
  // 한도 안에서 실제로 빌리는 금액
  loan: number;
  monthly: number;
  totalInterest: number;
};

export function calcLoan({
  price,
  assets,
  criteria,
  rate,
  years,
}: {
  price: number;
  assets: number;
  criteria: LoanCriteria;
  rate: number;
  years: number;
}): LoanResult {
  const ltv = maxLtv(criteria);
  const limit = Math.floor((price * ltv) / 100);
  const needed = Math.max(0, price - assets);
  const ok = needed <= limit;
  const loan = Math.min(needed, limit);
  const monthly = monthlyPayment(loan, rate, years);
  return {
    ltv,
    limit,
    needed,
    ok,
    shortfall: ok ? 0 : needed - limit,
    loan,
    monthly,
    totalInterest: Math.max(0, monthly * years * 12 - loan),
  };
}

// 슬라이더 눈금. 1천만 원 단위로 맞춘다
export const ASSET_STEP = 1e7;
export const snapAssets = (v: number, price: number) =>
  Math.min(price, Math.max(0, Math.round(v / ASSET_STEP) * ASSET_STEP));

// 대출 계산기 기본 매매가. 고른 평형의 가장 최근 매매(해제 제외), 없으면 단지의 가장 최근 매매
export function latestSalePrice(
  items: Transaction[],
  area: number | null | undefined,
): number | null {
  const sales = items
    .filter((t) => t.deal_type === "sale" && !t.is_cancelled && t.price)
    .sort((x, y) => y.contract_date.localeCompare(x.contract_date));
  return (
    (sales.find((t) => t.exclusive_area_m2 === area) ?? sales[0])?.price ?? null
  );
}
