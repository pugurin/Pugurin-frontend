// 짝 맞추기 뒤에 푸는 추가 문제 (#84): 매물 카드 번역하기, 헷갈리는 쌍 고르기.
// 같은 날·같은 땅이면 같은 문제가 나오고, 틀린 보기의 용어는 다음 날 짝 맞추기 복습에 들어간다
import type { Parcel } from "../api/types";

export type QuizChoice = {
  id: string;
  text: string;
  // 이 보기를 고르면 잘못 읽은 용어. 틀렸을 때 복습 대상에 넣는다
  termId?: string;
};
export type Quiz = {
  kind: "translate" | "confusable";
  id: string;
  title: string;
  prompt: string;
  // 번역하기에서 보여주는 땅 카드 한 줄
  card?: string;
  // 지도에서 본 땅이 아니라 샘플 카드인지
  sample?: boolean;
  choices: QuizChoice[];
  answerId: string;
  explain: string;
};

const PYEONG_M2 = 3.3058;

function hash(value: string) {
  let n = 2166136261;
  for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
function shuffle<T extends { id: string }>(items: T[], seed: string) {
  return [...items].sort(
    (a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`),
  );
}

// ---------- 매물 카드 번역하기 ----------

export type LandCard = {
  category: string | null;
  zone: string | null;
  road: string | null;
  // 원/㎡
  pricePerM2: number | null;
};

const CATEGORY: Record<string, string> = {
  대: "집·건물을 지을 수 있는 땅",
  전: "밭으로 쓰는 땅",
  답: "논으로 쓰는 땅",
  임야: "산",
  과수원: "과수원으로 쓰는 땅",
  목장용지: "가축을 키우는 땅",
  잡종지: "여러 용도로 쓰는 땅",
  공장용지: "공장을 지을 수 있는 땅",
  주차장: "주차장으로 쓰는 땅",
};
// 잘못 읽은 보기에 쓰는 지목. 대는 밭으로, 나머지는 집 지을 땅으로 헷갈리게 한다
const wrongCategory = (category: string) =>
  category === "대" ? CATEGORY.전 : CATEGORY.대;

// 긴 이름이 먼저 걸리도록 순서를 지킨다
const ZONES: [string, string][] = [
  ["제1종전용주거", "단독주택 위주의 조용한 동네"],
  ["제2종전용주거", "저층 아파트 위주의 조용한 동네"],
  ["제1종일반주거", "4층 이하 주택 위주 동네"],
  ["제2종일반주거", "아파트·빌라 위주 동네"],
  ["제3종일반주거", "고층 아파트도 들어서는 동네"],
  ["준주거", "주택과 상가가 섞인 동네"],
  ["중심상업", "도심 한가운데 상업 지역"],
  ["일반상업", "상가·업무 건물 위주 동네"],
  ["근린상업", "동네 상가 위주 지역"],
  ["유통상업", "시장·물류 위주 지역"],
  ["전용공업", "공장 전용 지역"],
  ["일반공업", "공장 위주 지역"],
  ["준공업", "공장과 주택이 섞인 지역"],
  ["보전녹지", "자연을 지키려고 개발을 막아 둔 녹지"],
  ["생산녹지", "농사를 위해 남겨 둔 녹지"],
  ["자연녹지", "개발을 조금만 허용하는 녹지"],
  ["계획관리", "계획을 세워 개발할 수 있는 시골 땅"],
  ["생산관리", "농사 위주로 관리하는 시골 땅"],
  ["보전관리", "자연 보전 위주로 관리하는 시골 땅"],
];
const zonePlain = (zone: string) =>
  ZONES.find(([key]) => zone.replace(/\s/g, "").includes(key))?.[1] ?? null;
const shortZone = (zone: string) => zone.replace(/지역$/, "");
const wrongZone = (zone: string) =>
  /상업/.test(zone) ? "단독주택 위주의 조용한 동네" : "상가·업무 건물 위주 동네";

const ROADS: [string, string][] = [
  ["광대로", "폭 25m가 넘는 큰 도로"],
  ["중로", "폭 12~25m 도로"],
  ["소로", "폭 8~12m 도로"],
  ["세로", "폭 8m가 안 되는 좁은 도로"],
];
// 예: 중로한면, 소로각지, 세로한면(가), 세로각지(불), 맹지
function roadPlain(road: string) {
  const r = road.replace(/\s/g, "");
  if (r.includes("맹지")) return "도로에 닿지 않은 땅(맹지)";
  const width = ROADS.find(([key]) => r.startsWith(key));
  if (!width) return null;
  const sides = r.includes("각지") ? "두 면 이상" : "한쪽";
  const car = r.includes("(불)")
    ? " (차가 못 다녀요)"
    : r.includes("(가)")
      ? " (차가 다닐 수 있어요)"
      : "";
  return `${width[1]}에 ${sides}이 닿은 땅${car}`;
}
const wrongRoad = (road: string) =>
  road.includes("맹지")
    ? "폭 12~25m 도로에 한쪽이 닿은 땅"
    : "도로에 닿지 않은 땅(맹지)";

const manwon = (won: number) =>
  `${Math.round(won / 10000).toLocaleString("ko-KR")}만`;
const perPyeong = (wonPerM2: number) =>
  `${Math.round((wonPerM2 * PYEONG_M2) / 10000).toLocaleString("ko-KR")}만 원`;

// 땅 정보가 없을 때 쓰는 샘플 카드 (부산 조례 기준 예시값)
export const SAMPLE_CARDS: LandCard[] = [
  {
    category: "대",
    zone: "제2종일반주거지역",
    road: "중로한면",
    pricePerM2: 5_120_000,
  },
  {
    category: "전",
    zone: "자연녹지지역",
    road: "세로한면(가)",
    pricePerM2: 380_000,
  },
  {
    category: "대",
    zone: "일반상업지역",
    road: "소로각지",
    pricePerM2: 12_400_000,
  },
  { category: "임야", zone: "보전녹지지역", road: "맹지", pricePerM2: 52_000 },
];

// 필지 응답을 카드로. 용도지역은 면적 비율이 가장 큰 것을 쓴다
export function cardFromParcel(parcel: Parcel | null | undefined) {
  if (!parcel) return null;
  const zone =
    [...(parcel.zonings ?? [])].sort(
      (a, b) => (b.area_ratio ?? 0) - (a.area_ratio ?? 0),
    )[0]?.zone_type ?? null;
  const card: LandCard = {
    category: parcel.land_category ?? null,
    zone,
    road: parcel.road_side ?? null,
    pricePerM2: parcel.official_land_price_per_m2 ?? null,
  };
  return parts(card).length >= 3 ? card : null;
}

type Part = {
  termId: string;
  label: string;
  plain: string;
  wrong: string;
  // 해설에서 "원래 말 = 쉬운 말"로 보여줄 내용
  explain: string;
};
function parts(card: LandCard): Part[] {
  const list: Part[] = [];
  const category = card.category && CATEGORY[card.category];
  if (card.category && category)
    list.push({
      termId: "land-category",
      label: card.category,
      plain: category,
      wrong: wrongCategory(card.category),
      explain: `${card.category}(지목) = ${category}`,
    });
  const zone = card.zone && zonePlain(card.zone);
  if (card.zone && zone)
    list.push({
      termId: "zoning",
      label: shortZone(card.zone),
      plain: zone,
      wrong: wrongZone(card.zone),
      explain: `${shortZone(card.zone)}(용도지역) = ${zone}`,
    });
  const road = card.road && roadPlain(card.road);
  if (card.road && road)
    list.push({
      termId: "road-side",
      label: card.road,
      plain: road,
      wrong: wrongRoad(card.road),
      explain: `${card.road}(도로접면) = ${road}`,
    });
  if (card.pricePerM2 != null && card.pricePerM2 > 0) {
    const price = perPyeong(card.pricePerM2);
    list.push({
      termId: "official-price",
      label: `공시지가 ㎡당 ${manwon(card.pricePerM2)}`,
      plain: `나라가 정한 땅값이 평당 약 ${price}`,
      wrong: `최근 평당 약 ${price}에 팔린 땅`,
      explain: `공시지가 = 나라가 정한 땅값이에요. 실제로 팔린 값(실거래가)과 달라요`,
    });
  }
  return list;
}
// 카드의 한 칸이 보기의 한 줄이 되도록 줄을 나눠 이어 붙인다
const sentence = (texts: string[]) => texts.join("\n");

export function translateQuiz(
  dateKey: string,
  parcel?: Parcel | null,
): Quiz | null {
  const fromMap = cardFromParcel(parcel);
  const card =
    fromMap ?? SAMPLE_CARDS[hash(`${dateKey}:카드`) % SAMPLE_CARDS.length];
  const list = parts(card);
  if (list.length < 2) return null;
  // 보기마다 한 부분만 잘못 읽은 문장을 만든다. 어느 부분을 틀리게 할지는 날짜로 고른다
  const wrongParts = shuffle(
    list.map((p, i) => ({ ...p, id: String(i) })),
    `${dateKey}:틀린부분`,
  ).slice(0, 2);
  const choices: QuizChoice[] = shuffle(
    [
      { id: "answer", text: sentence(list.map((p) => p.plain)) },
      ...wrongParts.map((w) => ({
        id: `wrong-${w.termId}`,
        termId: w.termId,
        text: sentence(list.map((p) => (p.termId === w.termId ? p.wrong : p.plain))),
      })),
    ],
    `${dateKey}:보기`,
  );
  return {
    kind: "translate",
    id: `translate-${list.map((p) => p.label).join("|")}`,
    title: "매물 카드 번역하기",
    prompt: "이 땅 카드를 쉬운 말로 바꾸면?",
    card: list.map((p) => p.label).join(" · "),
    sample: !fromMap,
    choices,
    answerId: "answer",
    explain: list.map((p) => p.explain).join("\n"),
  };
}

// ---------- 헷갈리는 쌍 고르기 ----------

type Pair = {
  id: string;
  a: { termId: string; text: string };
  b: { termId: string; text: string };
  questions: { prompt: string; answer: "a" | "b"; explain: string }[];
};
export const CONFUSABLE_PAIRS: Pair[] = [
  {
    id: "bcr-far",
    a: { termId: "bcr", text: "건폐율" },
    b: { termId: "far", text: "용적률" },
    questions: [
      {
        prompt: "땅 100평에 건물 바닥이 60평이면 ___이 60%",
        answer: "a",
        explain:
          "건폐율은 위에서 내려다본 건물 바닥 넓이예요. 층수는 따지지 않아요.",
      },
      {
        prompt: "땅 100평에 층마다 50평씩 5층을 지으면 ___이 250%",
        answer: "b",
        explain:
          "용적률은 모든 층 바닥을 더한 넓이(50평×5층=250평)를 땅 넓이로 나눠요.",
      },
    ],
  },
  {
    id: "exclusive-supply",
    a: { termId: "exclusive-area", text: "전용면적" },
    b: { termId: "supply-area", text: "공급면적" },
    questions: [
      {
        prompt: "현관문 안쪽, 우리 집만 쓰는 방·거실·주방 넓이는 ___",
        answer: "a",
        explain: "전용면적은 우리 집만 쓰는 공간이에요. 발코니는 빠져요.",
      },
      {
        prompt: "우리 집 넓이에 계단·복도까지 나눠 더한 넓이는 ___",
        answer: "b",
        explain:
          "공급면적은 전용면적에 계단·복도 같은 함께 쓰는 공간을 더한 넓이예요. 흔히 말하는 '34평'이 이 기준이에요.",
      },
    ],
  },
  {
    id: "official-actual",
    a: { termId: "official-price", text: "공시지가" },
    b: { termId: "actual-price", text: "실거래가" },
    questions: [
      {
        prompt: "나라가 매년 1월 1일 기준으로 정해 알려주는 땅값은 ___",
        answer: "a",
        explain:
          "공시지가는 세금·보상금을 정하는 기준이에요. 실제 팔린 값과 달라요.",
      },
      {
        prompt: "지난달 옆 땅이 실제로 팔린 가격은 ___",
        answer: "b",
        explain: "실거래가는 사고판 사람이 신고한 실제 가격이에요.",
      },
    ],
  },
];

// 오늘 짝 맞추기에서 틀린 용어가 들어 있는 쌍을 먼저 고르고, 없으면 날짜로 고른다
export function confusableQuiz(
  dateKey: string,
  wrongTermIds: string[] = [],
): Quiz {
  const review = CONFUSABLE_PAIRS.filter((p) =>
    [p.a.termId, p.b.termId].some((id) => wrongTermIds.includes(id)),
  );
  const pool = review.length ? review : CONFUSABLE_PAIRS;
  const pair = pool[hash(`${dateKey}:쌍`) % pool.length];
  const question =
    pair.questions[hash(`${dateKey}:쌍문제`) % pair.questions.length];
  return {
    kind: "confusable",
    id: `confusable-${pair.id}-${pair.questions.indexOf(question)}`,
    title: "헷갈리는 쌍 고르기",
    prompt: question.prompt,
    choices: [
      { id: "a", text: pair.a.text, termId: pair.a.termId },
      { id: "b", text: pair.b.text, termId: pair.b.termId },
    ],
    answerId: question.answer,
    explain: question.explain,
  };
}

export function dailyQuizzes(
  dateKey: string,
  options: { parcel?: Parcel | null; wrongTermIds?: string[] } = {},
): Quiz[] {
  const translate = translateQuiz(dateKey, options.parcel);
  return [
    ...(translate ? [translate] : []),
    confusableQuiz(dateKey, options.wrongTermIds),
  ];
}

// 틀린 보기를 골랐을 때 복습에 넣을 용어. 헷갈리는 쌍은 정답 용어를 넣는다
export function missedTermId(quiz: Quiz, choiceId: string) {
  if (choiceId === quiz.answerId) return null;
  if (quiz.kind === "confusable")
    return quiz.choices.find((c) => c.id === quiz.answerId)?.termId ?? null;
  return quiz.choices.find((c) => c.id === choiceId)?.termId ?? null;
}
