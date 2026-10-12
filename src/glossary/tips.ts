// 로딩 중 용어 팁 (F-GLOS-03, 와이어프레임 01-glossary-tips T01~T03)
// 백엔드 /glossary/tips가 아직 없어 용어 목록(이름 + 한 줄 설명)으로 팁을 만든다
import type { Term } from "../api/types";
import { TERMS } from "../api/terms";

// 어느 화면을 불러오는 중인지. 화면에 맞는 분류에서 팁을 고른다
export type TipContext = "splash" | "complex" | "region" | "land";
const CATEGORIES: Record<TipContext, Term["category"][] | null> = {
  splash: null, // 전체
  complex: ["building", "trade"],
  region: ["trade", "building"],
  land: ["land"],
};

// 로딩이 이 시간을 넘을 때만 팁을 보여준다(빨리 끝나면 깜빡이지 않게)
export const TIP_DELAY_MS = 1000;

// 팁 목록을 못 받을 때(오프라인) 쓰는 기본 팁 10개: 앱에 넣어 둔 용어 중 관리자 순서 앞쪽
export const DEFAULT_TIPS: Term[] = TERMS.slice()
  .sort((a, b) => a.display_order - b.display_order)
  .slice(0, 10);

// 매물 유형 탭을 바꿀 때 로딩 화면(용어 팁)을 보여주는 최소 시간
export const TYPE_SWITCH_MS = 1000;

let lastTipId: string | null = null;

// 화면에 맞는 분류에서 직전 팁과 다른 용어를 고른다. 용어 목록이 없으면 기본 팁 10개에서 고른다
export function pickTip(
  terms: Term[],
  context: TipContext,
  last: string | null = lastTipId,
  random: () => number = Math.random,
): Term {
  const source = terms.length ? terms : DEFAULT_TIPS;
  const categories = CATEGORIES[context];
  const matching = categories
    ? source.filter((t) => categories.includes(t.category))
    : source;
  const pool = (matching.length ? matching : source).filter(
    (t) => t.short_definition,
  );
  const fresh = pool.length > 1 ? pool.filter((t) => t.id !== last) : pool;
  const tip = fresh[Math.floor(random() * fresh.length)] ?? source[0];
  lastTipId = tip.id;
  return tip;
}
