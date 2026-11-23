import type { Repository } from "../api/repository";
import type { Deal, Filters, Transaction } from "../api/types";
import { formatMan, formatPrice } from "./market";

// 단지 시트에서 고른 평형의 최근 1년 평균가.
// 백엔드 통계는 평형별 중앙값 평당가만 주고 평균가는 없어서, 단지 거래를 받아 앱에서 계산한다.
// 백엔드가 평형별 평균가를 주게 되면 그 값으로 바꾼다.

export const AVERAGE_MONTHS = 12;
const PAGE_SIZE = 100; // 단지 거래 API의 최대 page_size
const MAX_PAGES = 10; // 거래가 아주 많은 단지에서도 요청이 끝없이 늘지 않게

export type AreaAverage = {
  count: number;
  price: number | null;
  deposit: number | null;
  monthly_rent: number | null;
};

// 오늘에서 n개월 전 날짜(YYYY-MM-DD, 현지 시간)
export function monthsAgo(n: number, today = new Date()) {
  const d = new Date(
    today.getFullYear(),
    today.getMonth() - n,
    today.getDate(),
  );
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 단지 거래 API는 기간·평형 필터를 받지 않는다. 최신순으로 100건씩 받다가
// since보다 오래된 거래가 나오거나 마지막 페이지면 멈춘다. 해제 거래는 받지 않는다
export async function recentComplexTransactions(
  repo: Repository,
  filters: Filters,
  complexId: string,
  since: string,
  signal?: AbortSignal,
) {
  const all: Transaction[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await repo.transactions(
      filters,
      {
        complexId,
        sort: "contract_date_desc",
        cancelled: false,
        page,
        pageSize: PAGE_SIZE,
      },
      signal,
    );
    all.push(...r.data);
    const last = r.data[r.data.length - 1];
    const totalPages = r.meta?.total_pages ?? page;
    if (!last || last.contract_date < since || page >= totalPages) break;
  }
  return all;
}

const avg = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;

// 같은 평형은 전용 ㎡를 반올림한 정수로 맞춘다(#160과 같은 규칙)
export function areaAverage(
  list: Transaction[],
  areaM2: number,
  since: string,
): AreaAverage | null {
  const key = Math.round(areaM2);
  const same = list.filter(
    (t) =>
      !t.is_cancelled &&
      t.contract_date >= since &&
      t.exclusive_area_m2 != null &&
      Math.round(t.exclusive_area_m2) === key,
  );
  if (!same.length) return null;
  const nums = (pick: (t: Transaction) => number | null | undefined) =>
    same.map(pick).filter((v): v is number => v != null);
  return {
    count: same.length,
    price: avg(nums((t) => t.price)),
    deposit: avg(nums((t) => t.deposit)),
    monthly_rent: avg(nums((t) => t.monthly_rent)),
  };
}

export function averageLabel(deal: Deal, a: AreaAverage) {
  const amount =
    deal === "sale"
      ? `평균 매매가 ${formatPrice(a.price)}`
      : deal === "jeonse"
        ? `평균 전세가 ${formatPrice(a.deposit)}`
        : `평균 월세 ${formatMan(a.deposit)}/${formatMan(a.monthly_rent)}`;
  return `${amount} · 거래 ${a.count}건`;
}
