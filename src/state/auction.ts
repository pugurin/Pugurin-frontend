import type { Auction, Meta } from "../api/types";
import { formatPrice } from "./market";

// 경매 마커를 그리기 시작하는 최소 줌 레벨
export const AUCTION_MIN_ZOOM = 14;
// 서버가 sort·exclude_share 쿼리를 지원한다. false로 바꾸면 경매 목록의 정렬 칩과 지분 빼기를 숨긴다
export const AUCTION_SERVER_SORT = true;

const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 3600000;
const SOON_DAYS = 7;

// 큰 금액을 "5억 2,000만"처럼 쓴다. 만 단위로 반올림한다
export function formatWon(v: number): string {
  const man = Math.round(v / 1e4);
  const eok = Math.floor(man / 1e4);
  const rest = man % 1e4;
  if (eok === 0) return `${rest.toLocaleString("ko-KR")}만`;
  if (rest === 0) return `${eok.toLocaleString("ko-KR")}억`;
  return `${eok.toLocaleString("ko-KR")}억 ${rest.toLocaleString("ko-KR")}만`;
}

// 공매는 입찰 마감(없으면 기일), 법원경매는 매각기일
export function ddayDate(a: Auction): string | null {
  return a.source === "public" ? (a.bid_end_at ?? a.sale_date) : a.sale_date;
}

// 날짜 문자열을 한국 날짜 기준 일 번호로 바꾼다. "YYYY-MM-DD"는 그대로, 시각이 있으면 한국 시간으로 맞춘다
function kstDay(s: string): number | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s))
    return Date.parse(`${s}T00:00:00Z`) / DAY_MS;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : Math.floor((t + KST_OFFSET_MS) / DAY_MS);
}

// 기일(ddayDate)의 한국 날짜 일 번호. 기일끼리 견줄 때 쓴다. 날짜가 없거나 못 읽으면 null
export function ddayKey(a: Auction): number | null {
  const d = ddayDate(a);
  return d ? kstDay(d) : null;
}

export function dday(
  a: Auction,
  today: Date,
): { label: string; soon: boolean } | null {
  if (a.is_closed) return null;
  const target = ddayKey(a);
  if (target == null) return null;
  const diff = target - Math.floor((today.getTime() + KST_OFFSET_MS) / DAY_MS);
  if (diff < 0) return null;
  return {
    label: diff === 0 ? "D-DAY" : `D-${diff}`,
    soon: diff <= SOON_DAYS,
  };
}

export function ratioLine(a: Auction): string | null {
  if (a.min_price_ratio == null || a.appraisal_price == null) return null;
  return `감정가 ${formatWon(a.appraisal_price)}의 ${Math.round(a.min_price_ratio)}%`;
}

// 최저가와 견줄 실거래가. 같은 평형 평균가가 있으면 평균, 없으면(오래된 서버) 최근 1건
export function tradeBase(a: Auction): { price: number; avg: boolean } | null {
  const avg = a.recent_trade_avg_price;
  if (avg != null && avg > 0) return { price: avg, avg: true };
  const recent = a.recent_trade_price;
  return recent != null && recent > 0 ? { price: recent, avg: false } : null;
}

// 최저가와 실거래의 차이. 비교할 값이 없으면 null
function tradeGap(a: Auction) {
  const b = tradeBase(a);
  const min = a.min_price;
  if (!b || min == null) return null;
  return {
    recent: b.price,
    avg: b.avg,
    pct: Math.round(Math.abs(1 - min / b.price) * 100),
    lower: min < b.price,
  };
}

// 최저가와 실거래(같은 평형 평균 또는 최근 1건)를 견준 문구. 값이 없으면 null
export function compareLine(
  a: Auction,
): { text: string; good: boolean } | null {
  const g = tradeGap(a);
  if (!g) return null;
  const price = formatPrice(g.recent);
  const label = g.avg ? "같은 평형 평균 실거래" : "최근 실거래";
  if (g.pct === 0) {
    return { text: `${label}(${price})와 비슷해요`, good: false };
  }
  if (!g.lower) {
    return { text: `${label}(${price})보다 ${g.pct}% 높아요`, good: false };
  }
  // 1건이면 평균이 그 거래와 같다
  const subject =
    a.recent_trade_count === 1
      ? `최근 거래 1건(${price})`
      : g.avg
        ? `${label}(${price})`
        : `같은 평형 최근 실거래(${price})`;
  return { text: `${subject}보다 ${g.pct}% 낮아요`, good: true };
}

export function auctionTitle(a: Auction): string {
  return (a.title ?? a.address).replace(/^부산광역시\s+/, "");
}

export function auctionAmount(a: Auction): string {
  return a.min_price == null
    ? "⚖ 최저가 미정"
    : `⚖ ${formatPrice(a.min_price)}`;
}

// 마커 보조 문구: 실거래 비교 > 감정가 비율 > D-day
export function auctionSub(a: Auction, today: Date): string {
  const g = tradeGap(a);
  if (g && g.pct > 0) return `실거래보다 ${g.pct}%${g.lower ? "↓" : "↑"}`;
  if (a.min_price_ratio != null) {
    return `감정가의 ${Math.round(a.min_price_ratio)}%`;
  }
  return dday(a, today)?.label ?? "";
}

// 출처 줄. 경매 시트와 목록이 같이 쓴다. 샘플이면 "샘플 데이터 · "를 앞에 붙인다
export function auctionSourceLine(
  meta: Meta | undefined,
  mode: string,
): string {
  const asOf = meta?.data_as_of?.slice(0, 10).replaceAll("-", ".");
  return [
    (meta?.data_mode ?? mode) === "sample" && "샘플 데이터",
    meta?.source_attribution &&
      `출처: ${[meta.source_attribution].flat().join(" · ")}`,
    asOf && `기준일 ${asOf}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
