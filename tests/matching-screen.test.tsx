import React from "react";
import { AppState } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Term } from "../src/api/types";
import { MatchingScreen } from "../src/screens/MatchingScreen";
import {
  createMatchingSession,
  loadMatchingRecord,
} from "../src/glossary/matching";
import { kstDateKey } from "../src/glossary/today";
import { randomQuizzes, type Quiz } from "../src/glossary/quiz";
const label = (quiz: Quiz, id = quiz.answerId) =>
  `보기 ${quiz.choices.find((c) => c.id === id)!.text.replace(/\n/g, ", ")}`;
const storage = vi.hoisted(() => ({
  data: new Map<string, string>(),
  getItem: vi.fn(),
  setItem: vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));
const terms: Term[] = Array.from({ length: 8 }, (_, i) => ({
  id: String(i),
  term: `용어${i}`,
  short_definition: `정확한 뜻 ${i}`,
  long_definition: "",
  example: "",
  category: "land",
  is_popular: true,
  display_order: i,
}));
beforeEach(() => {
  storage.data.clear();
  storage.getItem
    .mockReset()
    .mockImplementation(async (key: string) => storage.data.get(key) ?? null);
  storage.setItem
    .mockReset()
    .mockImplementation(async (key: string, value: string) => {
      storage.data.set(key, value);
    });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
});
const setup = () => {
  const onClose = vi.fn(),
    onTerm = vi.fn(),
    onComplete = vi.fn();
  const view = render(
    <MatchingScreen
      terms={terms}
      onClose={onClose}
      onTerm={onTerm}
      onComplete={onComplete}
    />,
  );
  return { ...view, onClose, onTerm, onComplete };
};
async function ready() {
  await screen.findByLabelText(
    `단어 ${terms.find((t) => t.id === createMatchingSession(terms).termIds[0])!.term}`,
  );
}
describe("짝 맞추기 화면", () => {
  it("한국 시간 자정 직후 누르면 60초 점검 전에도 어제 세트를 완료하지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T14:59:59Z"));
    const actions = setup(); await ready();
    const yesterday = createMatchingSession(terms).termIds.map(id => terms.find(t => t.id === id)!);
    for (const term of yesterday.slice(0,4)) {
      fireEvent.click(screen.getByLabelText(`단어 ${term.term}`));
      fireEvent.click(screen.getByLabelText(`뜻 ${term.short_definition}`));
    }
    fireEvent.click(screen.getByLabelText(`단어 ${yesterday[4].term}`));
    await waitFor(async () => expect((await loadMatchingRecord())?.session.matchedIds).toHaveLength(4));
    vi.setSystemTime(new Date("2026-10-12T15:00:00Z"));
    fireEvent.click(screen.getByLabelText(`뜻 ${yesterday[4].short_definition}`));
    expect(screen.getByText("0/5")).toBeTruthy();
    expect(actions.onComplete).not.toHaveBeenCalled();
    await waitFor(async () => expect((await loadMatchingRecord())?.session.dateKey).toBe("2026-10-13"));
  });
  it("다음 날 앱이 활성화되면 즉시 새 세트를 보여준다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T14:59:59Z"));
    let active: ((state: string) => void) | undefined;
    vi.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      active = listener; return { remove: vi.fn() };
    });
    setup(); await ready();
    const term = terms.find(t => t.id === createMatchingSession(terms).termIds[0])!;
    fireEvent.click(screen.getByLabelText(`단어 ${term.term}`));
    fireEvent.click(screen.getByLabelText(`뜻 ${term.short_definition}`));
    expect(screen.getByText("1/5")).toBeTruthy();
    vi.setSystemTime(new Date("2026-10-12T15:00:00Z"));
    act(() => active?.("active"));
    expect(screen.getByText("0/5")).toBeTruthy();
    await waitFor(async () => expect((await loadMatchingRecord())?.session.dateKey).toBe("2026-10-13"));
  });

  it("뜻을 먼저 고르면 맞는 짝을 잠그고 닫았다 열면 이어서 한다", async () => {
    const first = setup();
    await ready();
    const id = createMatchingSession(terms).termIds[0],
      term = terms.find((t) => t.id === id)!;
    fireEvent.click(screen.getByLabelText(`뜻 ${term.short_definition}`));
    fireEvent.click(screen.getByLabelText(`단어 ${term.term}`));
    await waitFor(() => expect(screen.getByText("1/5")).toBeTruthy());
    await waitFor(async () =>
      expect((await loadMatchingRecord())?.session.matchedIds).toEqual([id]),
    );
    fireEvent.click(screen.getByLabelText("짝 맞추기 닫기"));
    await waitFor(() => expect(first.onClose).toHaveBeenCalled());
    first.unmount();
    setup();
    await ready();
    expect(screen.getByText("1/5")).toBeTruthy();
    expect(
      screen.getByLabelText(`단어 ${term.term}`).getAttribute("aria-disabled"),
    ).toBe("true");
  });
  it("틀린 짝을 0.8초 뒤 풀고 두 번 틀린 단어의 원래 뜻을 알려준다", async () => {
    setup();
    await ready();
    const [a, b] = createMatchingSession(terms).termIds.map(
      (id) => terms.find((t) => t.id === id)!,
    );
    vi.useFakeTimers();
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByLabelText(`단어 ${a.term}`));
      fireEvent.click(screen.getByLabelText(`뜻 ${b.short_definition}`));
      expect(screen.getByText("짝이 아니에요")).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });
      expect(screen.queryByText("짝이 아니에요")).toBeNull();
    }
    expect(screen.getByText(`${a.term} · ${a.short_definition}`)).toBeTruthy();
  });
  it("완료 후 결과를 열고 용어 상세로 이동한다", async () => {
    const actions = setup();
    await ready();
    const daily = createMatchingSession(terms).termIds.map(
      (id) => terms.find((t) => t.id === id)!,
    );
    for (const term of daily) {
      fireEvent.click(screen.getByLabelText(`단어 ${term.term}`));
      fireEvent.click(screen.getByLabelText(`뜻 ${term.short_definition}`));
    }
    await waitFor(() => expect(actions.onComplete).toHaveBeenCalledWith(1));
    // 무작위 뽑기를 고정해 화면에 나올 문제를 미리 계산한다
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    fireEvent.click(screen.getByText("다음 문제"));
    const quizzes = randomQuizzes({ random: () => 0.3 });
    expect(quizzes).toHaveLength(4);
    // 모두 정답으로 푼다
    quizzes.forEach((quiz, i) => {
      expect(screen.getByText(`추가 ${i + 1}/4`)).toBeTruthy();
      expect(screen.getByText(quiz.prompt)).toBeTruthy();
      fireEvent.click(screen.getByLabelText(label(quiz)));
      expect(screen.getByText("✓ 맞았어요")).toBeTruthy();
      fireEvent.click(screen.getByText(i < 3 ? "다음 문제" : "결과 보기"));
    });
    expect(screen.getByText("오늘의 용어 끝")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(`${daily[0].term} 용어 상세 보기`));
    expect(actions.onTerm).toHaveBeenCalledWith(daily[0]);
    expect((await loadMatchingRecord())?.completedDates).toEqual([
      kstDateKey(),
    ]);
  });
  it("추가 문제에서 틀리면 이유를 보여주고 잘못 읽은 용어를 복습에 넣는다", async () => {
    const parcel = {
      pnu: "1",
      jibun_address: "부산 해운대구 우동 1",
      land_category: "전",
      road_side: "맹지",
      official_land_price_per_m2: 380_000,
      zonings: [
        {
          zone_type: "자연녹지지역",
          area_ratio: 1,
          inclusion: "포함",
          max_building_coverage_ratio: 20,
          max_floor_area_ratio: 80,
        },
      ],
    };
    render(
      <MatchingScreen
        terms={terms}
        parcel={parcel}
        onClose={() => {}}
        onTerm={() => {}}
      />,
    );
    await ready();
    for (const term of createMatchingSession(terms).termIds.map(
      (id) => terms.find((t) => t.id === id)!,
    )) {
      fireEvent.click(screen.getByLabelText(`단어 ${term.term}`));
      fireEvent.click(screen.getByLabelText(`뜻 ${term.short_definition}`));
    }
    await waitFor(async () =>
      expect((await loadMatchingRecord())?.completedDates).toEqual([kstDateKey()]),
    );
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    await waitFor(() => {
      fireEvent.click(screen.getByText("다음 문제"));
      expect(screen.getByText("추가 1/4")).toBeTruthy();
    });
    // 지도에서 본 땅 카드는 꼭 들어간다. 그 문제까지 정답으로 넘긴다
    const quizzes = randomQuizzes({ parcel, random: () => 0.3 });
    const at = quizzes.findIndex((q) => q.kind === "translate" && !q.sample);
    expect(at).toBeGreaterThanOrEqual(0);
    for (const before of quizzes.slice(0, at)) {
      fireEvent.click(screen.getByLabelText(label(before)));
      fireEvent.click(screen.getByText("다음 문제"));
    }
    const quiz = quizzes[at];
    expect(screen.getByText("전 · 자연녹지 · 맹지 · 공시지가 ㎡당 38만")).toBeTruthy();
    expect(screen.queryByText(/샘플 카드예요/)).toBeNull();
    const wrong = quiz.choices.find((c) => c.id !== quiz.answerId)!;
    fireEvent.click(screen.getByLabelText(label(quiz, wrong.id)));
    expect(screen.getByText("아쉬워요. 내일 다시 나와요")).toBeTruthy();
    expect(screen.getByText(/맹지\(도로접면\) = 도로에 닿지 않은 땅/)).toBeTruthy();
    await waitFor(async () =>
      expect(
        (await loadMatchingRecord())?.session.wrongCounts[wrong.termId!],
      ).toBe(1),
    );
    expect((await loadMatchingRecord())?.completedDates).toEqual([kstDateKey()]);
  });
  it("저장소 읽기 실패를 숨기지 않고 다시 불러올 수 있다", async () => {
    storage.getItem.mockRejectedValueOnce(new Error("기기 오류"));
    setup();
    expect(await screen.findByText("진행을 불러오지 못했어요")).toBeTruthy();
    fireEvent.click(screen.getByText("다시 시도"));
    await ready();
  });
  it("지난 결과가 손상되어도 새 세트로 시작하고 용어 부족은 안내한다", async () => {
    storage.data.set(
      "pugurin.matching.v1",
      JSON.stringify({ session: { termIds: ["없음"] } }),
    );
    const first = setup();
    await ready();
    expect(screen.getByText("0/5")).toBeTruthy();
    first.unmount();
    render(
      <MatchingScreen
        terms={terms.slice(0, 3)}
        onClose={() => {}}
        onTerm={() => {}}
      />,
    );
    expect(
      await screen.findByText("짝 맞추기에 필요한 용어가 아직 부족해요"),
    ).toBeTruthy();
  });
  it("진행 저장 실패 후 현재 진행을 다시 저장할 수 있다", async () => {
    setup();
    await ready();
    storage.setItem.mockRejectedValueOnce(new Error("기기 오류"));
    const a = terms.find(
      (t) => t.id === createMatchingSession(terms).termIds[0],
    )!;
    fireEvent.click(screen.getByLabelText(`단어 ${a.term}`));
    expect(await screen.findByText("진행을 저장하지 못했어요")).toBeTruthy();
    fireEvent.click(screen.getByText("다시 저장"));
    await waitFor(() =>
      expect(screen.queryByText("진행을 저장하지 못했어요")).toBeNull(),
    );
  });
});
