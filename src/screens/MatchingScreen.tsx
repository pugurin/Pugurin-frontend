import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, View } from "react-native";
import type { Parcel, Term } from "../api/types";
import { Icon, IconBtn, T } from "../components/ui";
import { C } from "../theme/tokens";
import { kstDateKey } from "../glossary/today";
import {
  clearMatchingError,
  createMatchingSession,
  finishMatching,
  loadMatchingRecord,
  recordMatchingProgress,
  saveMatchingRecord,
  selectMatching,
  type MatchingRecord,
  type MatchingSession,
} from "../glossary/matching";
import { dailyQuizzes, missedTermId, type Quiz } from "../glossary/quiz";
const GREEN = "#3f9a3a",
  DARK_GREEN = "#2f7a2c",
  WASH = "#eef7ec",
  BROWN = "#8c6a4c";
export function MatchingScreen({
  terms,
  onClose,
  onTerm,
  onComplete,
  parcel,
}: {
  terms: Term[];
  onClose: () => void;
  onTerm: (term: Term) => void;
  onComplete?: (streak: number) => void;
  // 지도에서 마지막으로 본 땅. 있으면 매물 카드 번역하기를 이 땅으로 낸다
  parcel?: Parcel | null;
}) {
  const [record, setRecord] = useState<MatchingRecord | null>(null);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false),
    [saveError, setSaveError] = useState(false),
    [result, setResult] = useState(false),
    [saving, setSaving] = useState(false);
  // 짝 맞추기 뒤 추가 문제. step이 null이면 짝 맞추기(또는 결과) 화면
  const [quizzes, setQuizzes] = useState<Quiz[]>([]),
    [step, setStep] = useState<number | null>(null),
    [picked, setPicked] = useState<string | null>(null);
  const current = useRef<MatchingRecord | null>(null),
    queue = useRef<Promise<void>>(Promise.resolve()),
    mounted = useRef(true),
    notified = useRef<string | null>(null),
    closing = useRef(false);
  const callback = useRef(onComplete);
  callback.current = onComplete;
  function put(next: MatchingRecord) {
    current.current = next;
    setRecord(next);
  }
  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const saved = await loadMatchingRecord();
      if (!mounted.current) return;
      const today = kstDateKey();
      const available = new Set(terms.map((t) => t.id));
      const resume =
        saved?.session.dateKey === today &&
        saved.session.termIds.every((id) => available.has(id));
      const session = resume
        ? {
            ...saved!.session,
            wrongPair: null,
            selectedTerm: saved!.session.wrongPair
              ? null
              : saved!.session.selectedTerm,
            selectedMeaning: saved!.session.wrongPair
              ? null
              : saved!.session.selectedMeaning,
          }
        : createMatchingSession(terms, today, saved?.session);
      const next = recordMatchingProgress(saved, session);
      put(next);
      setResult(Boolean(saved?.completedDates.includes(today)));
    } catch {
      if (mounted.current) setLoadError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [terms]);
  function persist(next: MatchingRecord, closeAfter = false) {
    setSaving(true);
    setSaveError(false);
    const operation = queue.current
      .catch(() => {})
      .then(() => saveMatchingRecord(next));
    queue.current = operation;
    void operation
      .then(() => {
        if (
          next.completedDates.includes(next.session.dateKey) &&
          notified.current !== next.session.dateKey
        ) {
          notified.current = next.session.dateKey;
          callback.current?.(next.streak);
        }
        if (mounted.current) {
          setSaveError(false);
          if (closeAfter) {
            closing.current = false;
            onClose();
          }
        }
      })
      .catch(() => {
        if (mounted.current) {
          setSaveError(true);
          closing.current = false;
        }
      })
      .finally(() => {
        if (mounted.current) setSaving(false);
      });
  }
  // 앱 복귀와 모든 입력에서 날짜를 검사해 자정 직후의 이전 세트 입력을 버린다.
  function refreshDay() {
    const old = current.current;
    const today = kstDateKey();
    if (!old || old.session.dateKey === today) return false;
    const next = recordMatchingProgress(old, createMatchingSession(terms, today, old.session));
    put(next);
    setResult(false);
    setStep(null);
    persist(next);
    return true;
  }
  function update(session: MatchingSession) {
    if (refreshDay() || session.dateKey !== kstDateKey()) return;
    const old = current.current;
    if (old?.session.dateKey !== session.dateKey) return;
    const next =
      session.termIds.length === 5 && session.matchedIds.length === 5
        ? finishMatching(old, session)
        : recordMatchingProgress(old, session);
    put(next);
    persist(next);
  }
  const session = record?.session;
  useEffect(() => {
    if (!session?.wrongPair) return;
    const timer = setTimeout(() => {
      const latest = current.current;
      if (refreshDay()) return;
      if (latest?.session.dateKey === session.dateKey && latest.session.wrongPair)
        update(clearMatchingError(latest.session));
    }, 800);
    return () => clearTimeout(timer);
  }, [session?.wrongPair]);
  useEffect(() => {
    const timer = setInterval(refreshDay, 60000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshDay();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [terms]);
  function close() {
    if (loading || loadError || !current.current) {
      onClose();
      return;
    }
    refreshDay();
    closing.current = true;
    persist(current.current, true);
  }
  function select(side: "term" | "meaning", id: string) {
    if (refreshDay()) return;
    const latest = current.current;
    if (!latest) return;
    const next = selectMatching(latest.session, side, id);
    if (next !== latest.session) update(next);
  }
  function startQuiz() {
    if (refreshDay() || !session) return;
    const next = dailyQuizzes(session.dateKey, {
      parcel,
      wrongTermIds: Object.keys(session.wrongCounts),
    });
    setQuizzes(next);
    setPicked(null);
    setStep(0);
  }
  function answer(choiceId: string) {
    if (refreshDay() || step == null || picked) return;
    setPicked(choiceId);
    const missed = missedTermId(quizzes[step], choiceId);
    const latest = current.current?.session;
    if (missed && latest)
      update({
        ...latest,
        wrongCounts: {
          ...latest.wrongCounts,
          [missed]: (latest.wrongCounts[missed] ?? 0) + 1,
        },
      });
  }
  function nextQuiz() {
    if (refreshDay() || step == null) return;
    setPicked(null);
    if (step + 1 < quizzes.length) setStep(step + 1);
    else {
      setStep(null);
      setResult(true);
    }
  }
  const quiz = step == null ? null : quizzes[step];
  const daily =
    session?.termIds
      .map((id) => terms.find((t) => t.id === id))
      .filter((t): t is Term => Boolean(t)) ?? [];
  const complete = session?.matchedIds.length === 5;
  const text = (size: number) => ({ fontSize: size, lineHeight: size * 1.4 });
  function card(term: Term, side: "term" | "meaning") {
    const matched = Boolean(session?.matchedIds.includes(term.id)),
      selected =
        (side === "term" ? session?.selectedTerm : session?.selectedMeaning) ===
        term.id;
    const wrong =
      (side === "term"
        ? session?.wrongPair?.term
        : session?.wrongPair?.meaning) === term.id;
    return (
      <Pressable
        key={`${side}-${term.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${side === "term" ? "단어" : "뜻"} ${side === "term" ? term.term : term.short_definition}`}
        accessibilityState={{
          selected,
          disabled: matched || Boolean(session?.wrongPair),
        }}
        disabled={matched || Boolean(session?.wrongPair)}
        onPress={() => select(side, term.id)}
        style={{
          flex: 1,
          minHeight: 68,
          paddingHorizontal: 8,
          paddingVertical: 8,
          borderWidth: 1.5,
          borderRadius: 12,
          borderColor: wrong
            ? BROWN
            : matched
              ? "#b9d5b4"
              : selected
                ? GREEN
                : C.rule,
          borderStyle: wrong ? "dashed" : "solid",
          backgroundColor: matched
            ? WASH
            : selected && !wrong
              ? GREEN
              : C.surface,
          opacity: matched ? 0.5 : 1,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 4,
        }}
      >
        {(matched || wrong) && (
          <Icon
            name={matched ? "check" : "close"}
            size={18}
            color={wrong ? BROWN : DARK_GREEN}
          />
        )}
        <T
          bold={side === "term"}
          color={wrong ? BROWN : selected && !matched ? C.surface : C.ink}
          style={[
            text(side === "term" ? 18 : 16),
            { textAlign: "center", flexShrink: 1 },
          ]}
        >
          {side === "term" ? term.term : term.short_definition}
        </T>
      </Pressable>
    );
  }
  const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
  const dateKey = session?.dateKey ?? kstDateKey();
  const day = new Date(`${dateKey}T00:00:00Z`),
    monday = (day.getUTCDay() + 6) % 7;
  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <View
        style={{
          minHeight: 56,
          paddingHorizontal: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <IconBtn name="close" label="짝 맞추기 닫기" onPress={close} />
        {result ? (
          <T bold style={text(20)}>
            오늘의 용어 끝
          </T>
        ) : quiz ? (
          <>
            <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
              {quizzes.map((q, i) => (
                <View
                  key={q.id}
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      i < step! || (i === step && picked) ? GREEN : C.bg2,
                  }}
                />
              ))}
            </View>
            <T bold style={text(15)}>
              추가 {step! + 1}/{quizzes.length}
            </T>
          </>
        ) : (
          session && (
            <>
              <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        i < session.matchedIds.length ? GREEN : C.bg2,
                    }}
                  />
                ))}
              </View>
              <T bold style={text(15)}>
                {session.matchedIds.length}/5
              </T>
            </>
          )
        )}
      </View>
      {loading ? (
        <View style={{ padding: 28, alignItems: "center", gap: 12 }}>
          <ActivityIndicator color={GREEN} />
          <T>진행을 불러오는 중…</T>
        </View>
      ) : loadError ? (
        <View style={{ padding: 24, gap: 12 }}>
          <T>진행을 불러오지 못했어요</T>
          <Action onPress={() => void load()}>다시 시도</Action>
        </View>
      ) : daily.length < 5 ? (
        <View style={{ padding: 24, gap: 12 }}>
          <T>짝 맞추기에 필요한 용어가 아직 부족해요</T>
          <T color={C.muted}>서로 다른 뜻이 있는 용어 5개가 필요해요.</T>
          <Action onPress={onClose}>지도로 돌아가기</Action>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {quiz ? (
              <QuizView quiz={quiz} picked={picked} onPick={answer} />
            ) : result ? (
              <>
                <View
                  style={{ alignItems: "center", paddingVertical: 16, gap: 6 }}
                >
                  <T bold color={DARK_GREEN} style={text(32)}>
                    {record?.streak}일 연속
                  </T>
                  <T color={C.muted} style={text(16)}>
                    내일도 하면 {(record?.streak ?? 0) + 1}일
                  </T>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingBottom: 16,
                  }}
                >
                  {weekdays.map((label, i) => {
                    const date = new Date(
                        day.getTime() + (i - monday) * 86400000,
                      )
                        .toISOString()
                        .slice(0, 10),
                      done = record?.completedDates.includes(date);
                    return (
                      <View
                        key={label}
                        style={{ alignItems: "center", gap: 7 }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: done ? GREEN : C.bg2,
                          }}
                        >
                          {done && (
                            <Icon name="check" color={C.surface} size={22} />
                          )}
                        </View>
                        <T size={15} color={C.muted}>
                          {label}
                        </T>
                      </View>
                    );
                  })}
                </View>
                <T bold style={text(18)}>
                  오늘 익힌 용어
                </T>
                {daily.map((term) => (
                  <Pressable
                    key={term.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${term.term} 용어 상세 보기`}
                    onPress={() => onTerm(term)}
                    style={{
                      minHeight: 72,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderColor: C.rule,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <T bold style={text(18)}>
                        {term.term}
                      </T>
                      <T color={C.muted} style={text(16)}>
                        {term.short_definition}
                      </T>
                    </View>
                    {Boolean(session?.wrongCounts[term.id]) && (
                      <T color={BROWN} style={text(13)}>
                        내일 다시
                      </T>
                    )}
                    <Icon name="right" color={C.light} />
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <View style={{ gap: 6, paddingBottom: 6 }}>
                  <T bold style={text(22)}>
                    단어와 뜻을 짝지어 보세요
                  </T>
                  <T color={C.muted} style={text(16)}>
                    오늘의 용어 5개
                  </T>
                </View>
                <View style={{ gap: 12 }}>
                  {daily.map((term, i) => {
                    const meaning = terms.find(
                      (t) => t.id === session!.meaningIds[i],
                    )!;
                    return (
                      <View
                        key={term.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "stretch",
                          gap: 12,
                        }}
                      >
                        {card(term, "term")}
                        {card(meaning, "meaning")}
                      </View>
                    );
                  })}
                </View>
                {session?.wrongPair && (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: "#f7f1eb",
                      gap: 4,
                    }}
                  >
                    <T bold color={BROWN} style={text(17)}>
                      짝이 아니에요
                    </T>
                    <T color={BROWN} style={text(16)}>
                      ✕ 다시 골라 보세요.
                    </T>
                  </View>
                )}
                {daily
                  .filter(
                    (t) =>
                      (session?.wrongCounts[t.id] ?? 0) >= 2 &&
                      !session?.matchedIds.includes(t.id),
                  )
                  .map((t) => (
                    <View
                      key={t.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: WASH,
                      }}
                    >
                      <T color={DARK_GREEN} style={text(16)}>
                        {t.term} · {t.short_definition}
                      </T>
                    </View>
                  ))}
                {complete && (
                  <View style={{ paddingVertical: 12, alignItems: "center" }}>
                    <T bold color={DARK_GREEN} style={text(20)}>
                      ✓ 5개 다 맞혔어요
                    </T>
                  </View>
                )}
              </>
            )}
            {saveError && (
              <View
                style={{
                  gap: 8,
                  padding: 12,
                  backgroundColor: "#f7f1eb",
                  borderRadius: 10,
                }}
              >
                <T color={BROWN}>진행을 저장하지 못했어요</T>
                <Action
                  onPress={() =>
                    current.current && persist(current.current, closing.current)
                  }
                >
                  다시 저장
                </Action>
              </View>
            )}
          </ScrollView>
          {quiz ? (
            picked && (
              <View
                style={{ padding: 16, borderTopWidth: 1, borderColor: C.rule }}
              >
                <Action onPress={nextQuiz}>
                  {step! + 1 < quizzes.length ? "다음 문제" : "결과 보기"}
                </Action>
              </View>
            )
          ) : (
            (result || complete) && (
              <View
                style={{ padding: 16, borderTopWidth: 1, borderColor: C.rule }}
              >
                <Action
                  disabled={saveError || saving}
                  onPress={result ? close : startQuiz}
                >
                  {result ? "지도로 돌아가기" : "다음 문제"}
                </Action>
              </View>
            )
          )}
        </>
      )}
    </View>
  );
}
// 매물 카드 번역하기·헷갈리는 쌍 고르기 한 문제. 고르면 정답과 이유를 바로 보여준다
function QuizView({
  quiz,
  picked,
  onPick,
}: {
  quiz: Quiz;
  picked: string | null;
  onPick: (choiceId: string) => void;
}) {
  const text = (size: number) => ({ fontSize: size, lineHeight: size * 1.4 });
  const correct = picked === quiz.answerId;
  const pair = quiz.kind === "confusable";
  return (
    <>
      <View style={{ gap: 6, paddingBottom: 6 }}>
        <T bold color={DARK_GREEN} style={text(15)}>
          {quiz.title}
        </T>
        <T bold style={text(22)}>
          {quiz.prompt}
        </T>
      </View>
      {quiz.card && (
        <View
          style={{
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: C.rule,
            backgroundColor: C.bg,
            gap: 6,
          }}
        >
          <T bold style={text(18)}>
            {quiz.card}
          </T>
          {quiz.sample && (
            <T color={C.muted} style={text(13)}>
              샘플 카드예요. 지도에서 땅을 눌러 보면 그 땅으로 나와요.
            </T>
          )}
        </View>
      )}
      <View style={{ gap: 10, flexDirection: pair ? "row" : "column" }}>
        {quiz.choices.map((choice) => {
          const isAnswer = choice.id === quiz.answerId,
            isPicked = choice.id === picked;
          const shown = Boolean(picked) && (isAnswer || isPicked);
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              accessibilityLabel={`보기 ${choice.text.replace(/\n/g, ", ")}`}
              accessibilityState={{
                selected: isPicked,
                disabled: Boolean(picked),
              }}
              disabled={Boolean(picked)}
              onPress={() => onPick(choice.id)}
              style={{
                flex: pair ? 1 : undefined,
                minHeight: pair ? 64 : 56,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1.5,
                borderStyle: shown && !isAnswer ? "dashed" : "solid",
                borderColor: shown ? (isAnswer ? GREEN : BROWN) : C.rule,
                backgroundColor: shown && isAnswer ? WASH : C.surface,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: pair ? "center" : "flex-start",
                gap: 8,
              }}
            >
              {shown && (
                <Icon
                  name={isAnswer ? "check" : "close"}
                  size={18}
                  color={isAnswer ? DARK_GREEN : BROWN}
                />
              )}
              <T
                bold={pair}
                color={shown && !isAnswer ? BROWN : C.ink}
                style={[text(pair ? 18 : 16), { flexShrink: 1 }]}
              >
                {choice.text}
              </T>
            </Pressable>
          );
        })}
      </View>
      {picked && (
        <View
          style={{
            padding: 12,
            borderRadius: 10,
            backgroundColor: correct ? WASH : "#f7f1eb",
            gap: 4,
          }}
        >
          <T bold color={correct ? DARK_GREEN : BROWN} style={text(17)}>
            {correct ? "✓ 맞았어요" : "아쉬워요. 내일 다시 나와요"}
          </T>
          <T color={correct ? DARK_GREEN : BROWN} style={text(16)}>
            {quiz.explain}
          </T>
        </View>
      )}
    </>
  );
}
function Action({
  children,
  onPress,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        borderRadius: 12,
        backgroundColor: GREEN,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <T bold color={C.surface} style={{ fontSize: 17, lineHeight: 24 }}>
        {children}
      </T>
    </Pressable>
  );
}
