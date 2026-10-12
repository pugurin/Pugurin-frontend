import { describe, expect, it } from "vitest";
import type { Term } from "../src/api/types";
import {
  createMatchingSession,
  dailyMatchingTerms,
  selectMatching,
  clearMatchingError,
  finishMatching,
  matchingStatus,
} from "../src/glossary/matching";
const terms: Term[] = Array.from({ length: 14 }, (_, i) => ({
  id: String(i),
  term: `용어${i}`,
  short_definition: `기존 뜻 ${i}`,
  long_definition: "",
  example: "",
  category: "land",
  is_popular: true,
  display_order: i,
}));
describe("오늘의 짝 맞추기", () => {
  it("목록 순서와 기기에 상관없이 같은 날 다섯 용어와 섞인 뜻을 고른다", () => {
    const first = createMatchingSession(terms, "2026-10-12");
    expect(first.termIds).toHaveLength(5);
    expect(createMatchingSession([...terms].reverse(), "2026-10-12")).toEqual(
      first,
    );
    expect(first.meaningIds).not.toEqual(first.termIds);
  });
  it("어제 틀린 용어는 최대 두 개 복습하고 나머지는 새로운 용어로 채운다", () => {
    const yesterday = createMatchingSession(terms, "2026-10-11");
    yesterday.wrongCounts = Object.fromEntries(
      yesterday.termIds.map((id) => [id, 1]),
    );
    const next = dailyMatchingTerms(terms, "2026-10-12", yesterday);
    expect(next.filter((t) => yesterday.termIds.includes(t.id))).toHaveLength(
      2,
    );
  });
  it("뜻부터 눌러도 맞는 짝은 잠기고 틀린 짝은 표시 후 풀린다", () => {
    let session = createMatchingSession(terms, "2026-10-12");
    const [a, b] = session.termIds;
    session = selectMatching(selectMatching(session, "meaning", a), "term", a);
    expect(session.matchedIds).toEqual([a]);
    expect(selectMatching(session, "term", a)).toEqual(session);
    session = selectMatching(
      selectMatching(session, "term", b),
      "meaning",
      a === session.meaningIds[0]
        ? session.meaningIds[1]
        : session.meaningIds[0],
    );
    // 이미 맞힌 뜻은 다시 고를 수 없다.
    if (!session.wrongPair)
      session = selectMatching(session, "meaning", session.termIds[2]);
    expect(session.wrongPair).toBeTruthy();
    expect(session.wrongCounts[b]).toBe(1);
    session = clearMatchingError(session);
    expect(session.selectedTerm).toBeNull();
    session = selectMatching(
      selectMatching(session, "meaning", session.termIds[2]),
      "term",
      b,
    );
    expect(session.wrongCounts[b]).toBe(2);
  });
  it("하루에 완료 기록은 한 번만 쌓고 하루 빠지면 연속 기록을 다시 시작한다", () => {
    const complete = (day: string) => {
      const s = createMatchingSession(terms, day);
      s.matchedIds = [...s.termIds];
      return s;
    };
    let record = finishMatching(null, complete("2026-10-10"));
    expect(record.streak).toBe(1);
    record = finishMatching(record, complete("2026-10-11"));
    expect(record.streak).toBe(2);
    expect(finishMatching(record, complete("2026-10-11")).streak).toBe(2);
    expect(matchingStatus(record, "2026-10-11")).toEqual({
      completed: true,
      streak: 2,
      matched: 5,
    });
    record = finishMatching(record, complete("2026-10-13"));
    expect(record.streak).toBe(1);
    expect(matchingStatus(record, "2026-10-15").streak).toBe(0);
  });
});
