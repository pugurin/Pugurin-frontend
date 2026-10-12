// 짝 맞추기 진행과 연속 기록은 로그인 없이 현재 기기에만 저장한다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Term } from "../api/types";
import { kstDateKey } from "./today";
export type MatchingSession = {
  dateKey: string;
  termIds: string[];
  meaningIds: string[];
  matchedIds: string[];
  selectedTerm: string | null;
  selectedMeaning: string | null;
  wrongPair: {
    term: string;
    meaning: string;
  } | null;
  wrongCounts: Record<string, number>;
};
export type MatchingRecord = {
  session: MatchingSession;
  completedDates: string[];
  lastCompletedDate: string | null;
  streak: number;
};
const KEY = "pugurin.matching.v1";
const dayNumber = (day: string) =>
  Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
function hash(value: string) {
  let n = 2166136261;
  for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
function ordered(terms: Term[], seed: string) {
  return [...terms].sort(
    (a, b) =>
      hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`) ||
      a.id.localeCompare(b.id),
  );
}
export function dailyMatchingTerms(
  terms: Term[],
  dateKey: string,
  previous?: MatchingSession,
): Term[] {
  // 뜻이 같은 항목은 한 세트에 중복하지 않아 한 뜻에 정답이 여러 개 생기지 않게 한다.
  const seen = new Set<string>();
  const pool = [...terms]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((t) => {
      if (!t.short_definition.trim() || seen.has(t.short_definition.trim()))
        return false;
      seen.add(t.short_definition.trim());
      return true;
    });
  const yesterday =
    previous && dayNumber(dateKey) - dayNumber(previous.dateKey) === 1
      ? previous
      : undefined;
  const review = yesterday
    ? ordered(
        pool.filter((t) => (yesterday.wrongCounts[t.id] ?? 0) > 0),
        dateKey,
      ).slice(0, 2)
    : [];
  const fresh = ordered(
    pool.filter((t) => !review.some((r) => r.id === t.id)),
    dateKey,
  );
  const newTerms = fresh.filter((t) => !yesterday?.termIds.includes(t.id));
  return [
    ...review,
    ...newTerms,
    ...fresh.filter((t) => !newTerms.some((n) => n.id === t.id)),
  ].slice(0, 5);
}
export function createMatchingSession(
  terms: Term[],
  dateKey = kstDateKey(),
  previous?: MatchingSession,
): MatchingSession {
  const picked = dailyMatchingTerms(terms, dateKey, previous);
  const termIds = picked.map((t) => t.id);
  let meaningIds = ordered(picked, `${dateKey}:뜻`).map((t) => t.id);
  if (meaningIds.length > 1 && meaningIds.every((id, i) => id === termIds[i]))
    meaningIds = [...meaningIds.slice(1), meaningIds[0]];
  return {
    dateKey,
    termIds,
    meaningIds,
    matchedIds: [],
    selectedTerm: null,
    selectedMeaning: null,
    wrongPair: null,
    wrongCounts: {},
  };
}
export function selectMatching(
  session: MatchingSession,
  side: "term" | "meaning",
  id: string,
): MatchingSession {
  if (
    session.wrongPair ||
    session.matchedIds.includes(id) ||
    !(side === "term" ? session.termIds : session.meaningIds).includes(id)
  )
    return session;
  const key = side === "term" ? "selectedTerm" : "selectedMeaning";
  const next = { ...session, [key]: session[key] === id ? null : id };
  if (next.selectedTerm && next.selectedMeaning) {
    if (next.selectedTerm === next.selectedMeaning)
      return {
        ...next,
        matchedIds: [...next.matchedIds, next.selectedTerm],
        selectedTerm: null,
        selectedMeaning: null,
      };
    return {
      ...next,
      wrongPair: { term: next.selectedTerm, meaning: next.selectedMeaning },
      wrongCounts: {
        ...next.wrongCounts,
        [next.selectedTerm]: (next.wrongCounts[next.selectedTerm] ?? 0) + 1,
      },
    };
  }
  return next;
}
export const clearMatchingError = (
  session: MatchingSession,
): MatchingSession => ({
  ...session,
  wrongPair: null,
  selectedTerm: null,
  selectedMeaning: null,
});
export function finishMatching(
  record: MatchingRecord | null,
  session: MatchingSession,
): MatchingRecord {
  if (session.termIds.length !== 5 || session.matchedIds.length !== 5)
    throw new Error("다섯 짝을 모두 맞혀야 완료할 수 있어요.");
  if (record?.completedDates.includes(session.dateKey))
    return { ...record, session };
  const streak =
    record?.lastCompletedDate &&
    dayNumber(session.dateKey) - dayNumber(record.lastCompletedDate) === 1
      ? record.streak + 1
      : 1;
  return {
    session,
    streak,
    lastCompletedDate: session.dateKey,
    completedDates: [...(record?.completedDates ?? []), session.dateKey],
  };
}
export function matchingStatus(
  record: MatchingRecord | null,
  dateKey = kstDateKey(),
) {
  const completed = Boolean(record?.completedDates.includes(dateKey));
  const recent =
    record?.lastCompletedDate &&
    dayNumber(dateKey) - dayNumber(record.lastCompletedDate) <= 1;
  return {
    completed,
    streak: recent ? record!.streak : 0,
    matched:
      record?.session.dateKey === dateKey
        ? record.session.matchedIds.length
        : 0,
  };
}
function validRecord(value: unknown): value is MatchingRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as MatchingRecord;
  const s = r.session;
  return Boolean(
    s &&
      /^\d{4}-\d{2}-\d{2}$/.test(s.dateKey) &&
      Array.isArray(s.termIds) &&
      Array.isArray(s.meaningIds) &&
      Array.isArray(s.matchedIds) &&
      s.termIds.length <= 5 &&
      s.meaningIds.length === s.termIds.length &&
      new Set(s.termIds).size === s.termIds.length &&
      s.meaningIds.every((id) => s.termIds.includes(id)) &&
      s.matchedIds.every((id) => s.termIds.includes(id)) &&
      typeof s.wrongCounts === "object" &&
      s.wrongCounts !== null &&
      Array.isArray(r.completedDates) &&
      typeof r.streak === "number",
  );
}
export async function loadMatchingRecord(): Promise<MatchingRecord | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return validRecord(value) ? value : null;
  } catch {
    return null;
  }
}
export const saveMatchingRecord = (record: MatchingRecord) =>
  AsyncStorage.setItem(KEY, JSON.stringify(record));
export function recordMatchingProgress(
  record: MatchingRecord | null,
  session: MatchingSession,
): MatchingRecord {
  return {
    ...(record ?? { completedDates: [], lastCompletedDate: null, streak: 0 }),
    session,
  };
}
