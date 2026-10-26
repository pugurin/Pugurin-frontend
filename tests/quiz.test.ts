import { describe, expect, it } from "vitest";
import type { Parcel } from "../src/api/types";
import {
  CONFUSABLE_PAIRS,
  cardFromParcel,
  confusableQuiz,
  missedTermId,
  randomQuizzes,
  translateQuiz,
} from "../src/glossary/quiz";

const parcel: Parcel = {
  pnu: "1",
  jibun_address: "부산 해운대구 우동 1",
  land_category: "대",
  official_land_price_per_m2: 5_120_000,
  road_side: "중로한면",
  zonings: [
    {
      zone_type: "일반상업지역",
      area_ratio: 0.2,
      inclusion: "저촉",
      max_building_coverage_ratio: 80,
      max_floor_area_ratio: 1000,
    },
    {
      zone_type: "제2종일반주거지역",
      area_ratio: 0.8,
      inclusion: "포함",
      max_building_coverage_ratio: 60,
      max_floor_area_ratio: 250,
    },
  ],
};

describe("매물 카드 번역하기", () => {
  it("지도에서 본 땅으로 카드를 만들고 면적이 가장 큰 용도지역을 쓴다", () => {
    const quiz = translateQuiz("2026-10-20", parcel)!;
    expect(quiz.sample).toBe(false);
    expect(quiz.card).toBe("대 · 제2종일반주거 · 중로한면 · 공시지가 ㎡당 512만");
    const answer = quiz.choices.find((c) => c.id === quiz.answerId)!;
    expect(answer.text.split("\n")).toEqual([
      "집·건물을 지을 수 있는 땅",
      "아파트·빌라 위주 동네",
      "폭 12~25m 도로에 한쪽이 닿은 땅",
      "나라가 정한 땅값이 평당 약 1,693만 원",
    ]);
  });
  it("보기 3개는 서로 다르고, 틀린 보기는 한 줄만 잘못 읽었다", () => {
    const quiz = translateQuiz("2026-10-20", parcel)!;
    expect(quiz.choices).toHaveLength(3);
    expect(new Set(quiz.choices.map((c) => c.text)).size).toBe(3);
    const answer = quiz.choices.find((c) => c.id === quiz.answerId)!.text.split("\n");
    for (const wrong of quiz.choices.filter((c) => c.id !== quiz.answerId)) {
      const lines = wrong.text.split("\n");
      expect(lines.filter((line, i) => line !== answer[i])).toHaveLength(1);
      expect(wrong.termId).toBeTruthy();
    }
  });
  it("땅 정보가 없거나 모자라면 샘플 카드로 낸다", () => {
    expect(translateQuiz("2026-10-20", null)!.sample).toBe(true);
    expect(cardFromParcel({ pnu: "1", jibun_address: "x", land_category: "대" })).toBeNull();
    expect(
      translateQuiz("2026-10-20", { pnu: "1", jibun_address: "x" })!.sample,
    ).toBe(true);
  });
  it("도로접면 표기를 쉬운 말로 푼다", () => {
    const answerOf = (road_side: string) =>
      translateQuiz("2026-10-20", { ...parcel, road_side })!
        .choices.find((c) => c.id === "answer")!
        .text.split("\n")[2];
    expect(answerOf("세로각지(불)")).toBe(
      "폭 8m가 안 되는 좁은 도로에 두 면 이상이 닿은 땅 (차가 못 다녀요)",
    );
    expect(answerOf("맹지")).toBe("도로에 닿지 않은 땅(맹지)");
  });
  it("같은 seed면 같은 문제가 나온다", () => {
    expect(translateQuiz("2026-10-20")).toEqual(translateQuiz("2026-10-20"));
  });
  it("틀린 보기를 고르면 잘못 읽은 용어를 복습에 넣는다", () => {
    const quiz = translateQuiz("2026-10-20", parcel)!;
    const wrong = quiz.choices.find((c) => c.id !== quiz.answerId)!;
    expect(missedTermId(quiz, wrong.id)).toBe(wrong.termId);
    expect(missedTermId(quiz, quiz.answerId)).toBeNull();
  });
});

describe("헷갈리는 쌍 고르기", () => {
  it("보기는 쌍의 두 용어이고 틀리면 정답 용어를 복습에 넣는다", () => {
    const quiz = confusableQuiz("2026-10-20");
    expect(quiz.choices).toHaveLength(2);
    const wrong = quiz.choices.find((c) => c.id !== quiz.answerId)!;
    const right = quiz.choices.find((c) => c.id === quiz.answerId)!;
    expect(missedTermId(quiz, wrong.id)).toBe(right.termId);
  });
  it("짝 맞추기에서 틀린 용어가 든 쌍을 먼저 낸다", () => {
    for (const day of ["2026-10-20", "2026-10-21", "2026-10-22"]) {
      const quiz = confusableQuiz(day, ["supply-area"]);
      expect(quiz.choices.map((c) => c.text)).toEqual(["전용면적", "공급면적"]);
    }
  });
  it("모든 쌍의 문제에 빈칸이 있다", () => {
    for (const pair of CONFUSABLE_PAIRS)
      for (const q of pair.questions) expect(q.prompt).toContain("___");
  });
});

// 테스트용으로 seed를 받는 간단한 난수 생성기
function rng(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
}

describe("무작위 추가 문제", () => {
  it("4개를 뽑고, 두 유형이 최소 1개씩 들어가며 같은 문제·같은 쌍은 겹치지 않는다", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const quizzes = randomQuizzes({ random: rng(seed) });
      expect(quizzes).toHaveLength(4);
      const kinds = quizzes.map((q) => q.kind);
      expect(kinds).toContain("translate");
      expect(kinds).toContain("confusable");
      expect(new Set(quizzes.map((q) => q.id)).size).toBe(4);
      const pairs = quizzes
        .filter((q) => q.kind === "confusable")
        .map((q) => q.id.replace(/-\d+$/, ""));
      expect(new Set(pairs).size).toBe(pairs.length);
    }
  });
  it("할 때마다 문제와 순서가 바뀐다", () => {
    const sets = new Set(
      Array.from({ length: 30 }, (_, i) =>
        randomQuizzes({ random: rng(i + 1) })
          .map((q) => q.id)
          .join(","),
      ),
    );
    expect(sets.size).toBeGreaterThan(20);
    const firstKinds = new Set(
      Array.from({ length: 30 }, (_, i) => randomQuizzes({ random: rng(i + 1) })[0].kind),
    );
    expect(firstKinds.size).toBe(2);
  });
  it("지도에서 본 땅 카드와 틀린 용어가 든 쌍은 꼭 들어간다", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const quizzes = randomQuizzes({
        parcel,
        wrongTermIds: ["property-tax"],
        random: rng(seed),
      });
      expect(
        quizzes.some(
          (q) => q.card === "대 · 제2종일반주거 · 중로한면 · 공시지가 ㎡당 512만" && !q.sample,
        ),
      ).toBe(true);
      expect(
        quizzes.some((q) => q.choices.some((c) => c.termId === "property-tax")),
      ).toBe(true);
    }
  });
  it("모든 샘플 카드와 쌍 문제가 언젠가 나온다", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 500; seed++)
      for (const q of randomQuizzes({ random: rng(seed) })) seen.add(q.id);
    const pairQuestions = CONFUSABLE_PAIRS.reduce((n, p) => n + p.questions.length, 0);
    expect([...seen].filter((id) => id.startsWith("confusable-"))).toHaveLength(pairQuestions);
    expect([...seen].filter((id) => id.startsWith("translate-"))).toHaveLength(8);
  });
});
