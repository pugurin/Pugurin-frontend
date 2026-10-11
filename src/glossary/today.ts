// 오늘의 용어 (F-GLOS-04, 와이어프레임 01-glossary-tips D01~D05)
// 백엔드 /glossary/today가 아직 없어 자주 찾는 용어 중 날짜(한국 시간)로 하나를 고른다.
// 같은 날이면 모든 사용자에게 같은 용어가 나온다
import type { Term } from "../api/types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 한국 시간 기준 날짜 "YYYY-MM-DD". 자정(한국 시간)에 바뀐다
export function kstDateKey(now: Date = new Date()) {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// "2026-10-11" → "10월 11일"
export function todayLabel(dateKey: string) {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${m}월 ${d}일`;
}

// 자주 찾는 용어(없으면 전체)를 관리자 순서 → 가나다순으로 세우고, 날짜 번호로 하나를 고른다
export function pickToday(terms: Term[], dateKey: string): Term | null {
  if (!terms.length) return null;
  const popular = terms.filter((t) => t.is_popular);
  const list = (popular.length ? popular : terms)
    .slice()
    .sort(
      (a, b) =>
        a.display_order - b.display_order || a.term.localeCompare(b.term, "ko"),
    );
  const day = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);
  return list[day % list.length];
}
