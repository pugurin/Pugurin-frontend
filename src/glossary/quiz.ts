// 짝 맞추기 뒤에 푸는 추가 문제 (#84): 매물 카드 번역하기, 헷갈리는 쌍 고르기.
// 추가 문제를 시작할 때마다 문제 풀에서 무작위로 뽑고, 틀린 보기의 용어는 다음 날 짝 맞추기 복습에 들어간다
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
  {
    category: "대",
    zone: "제1종전용주거지역",
    road: "세로각지(가)",
    pricePerM2: 2_310_000,
  },
  {
    category: "답",
    zone: "생산녹지지역",
    road: "세로한면(불)",
    pricePerM2: 210_000,
  },
  {
    category: "공장용지",
    zone: "준공업지역",
    road: "광대로한면",
    pricePerM2: 3_050_000,
  },
  {
    category: "대",
    zone: "준주거지역",
    road: "중로각지",
    pricePerM2: 6_870_000,
  },
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

// 카드 하나로 번역 문제를 만든다. seed로 틀린 보기와 보기 순서를 정한다
function cardQuiz(card: LandCard, sample: boolean, seed: string): Quiz | null {
  const list = parts(card);
  if (list.length < 2) return null;
  // 보기마다 한 부분만 잘못 읽은 문장을 만든다
  const wrongParts = shuffle(
    list.map((p, i) => ({ ...p, id: String(i) })),
    `${seed}:틀린부분`,
  ).slice(0, 2);
  const choices: QuizChoice[] = shuffle(
    [
      { id: "answer", text: sentence(list.map((p) => p.plain)) },
      ...wrongParts.map((w) => ({
        id: `wrong-${w.termId}`,
        termId: w.termId,
        text: sentence(
          list.map((p) => (p.termId === w.termId ? p.wrong : p.plain)),
        ),
      })),
    ],
    `${seed}:보기`,
  );
  return {
    kind: "translate",
    id: `translate-${list.map((p) => p.label).join("|")}`,
    title: "매물 카드 번역하기",
    prompt: "이 땅 카드를 쉬운 말로 바꾸면?",
    card: list.map((p) => p.label).join(" · "),
    sample,
    choices,
    answerId: "answer",
    explain: list.map((p) => p.explain).join("\n"),
  };
}

// 지도에서 본 땅이 있으면 그 땅으로, 없으면 seed로 샘플 카드 하나를 고른다
export function translateQuiz(
  seed: string,
  parcel?: Parcel | null,
): Quiz | null {
  const fromMap = cardFromParcel(parcel);
  const card =
    fromMap ?? SAMPLE_CARDS[hash(`${seed}:카드`) % SAMPLE_CARDS.length];
  return cardQuiz(card, !fromMap, seed);
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
      {
        prompt: "마당과 주차장을 얼마나 남겨야 하는지 정하는 건 ___",
        answer: "a",
        explain:
          "건폐율 한도만큼만 건물 바닥을 깔 수 있어서, 나머지 땅은 마당·주차장으로 남아요.",
      },
      {
        prompt: "같은 땅에 건물을 몇 층까지 올릴 수 있는지와 관련 깊은 건 ___",
        answer: "b",
        explain:
          "용적률이 높을수록 모든 층 바닥을 더한 넓이가 커져서 더 높이 지을 수 있어요.",
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
      {
        prompt: "실거래가 신고에 적는 '84㎡'는 ___",
        answer: "a",
        explain:
          "실거래가와 등기에는 전용면적을 적어요. 84㎡는 흔히 '34평형'이라고 부르는 집이에요.",
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
      {
        prompt: "재산세를 매길 때 기준으로 쓰는 땅값은 ___",
        answer: "a",
        explain:
          "세금과 보상금은 나라가 정한 공시지가를 기준으로 계산해요.",
      },
    ],
  },
  {
    id: "category-zoning",
    a: { termId: "land-category", text: "지목" },
    b: { termId: "zoning", text: "용도지역" },
    questions: [
      {
        prompt: "토지대장에 '대·전·답·임야'처럼 적힌 땅의 이름은 ___",
        answer: "a",
        explain:
          "지목은 그 땅 하나를 지금 무엇에 쓰는지 장부에 적어 둔 이름이에요.",
      },
      {
        prompt: "동네 전체를 주거·상업·녹지로 나눠 정해 둔 것은 ___",
        answer: "b",
        explain:
          "용도지역은 도시계획으로 넓은 구역에 정해 둔 쓰임새예요. 건폐율·용적률 한도가 여기서 정해져요.",
      },
      {
        prompt: "건폐율·용적률 한도를 정하는 기준은 ___",
        answer: "b",
        explain:
          "같은 '대'라도 용도지역이 주거냐 상업이냐에 따라 지을 수 있는 크기가 달라요.",
      },
    ],
  },
  {
    id: "acquisition-property",
    a: { termId: "acquisition-tax", text: "취득세" },
    b: { termId: "property-tax", text: "재산세" },
    questions: [
      {
        prompt: "땅을 산 직후 딱 한 번 내는 세금은 ___",
        answer: "a",
        explain: "취득세는 집이나 땅을 살 때 한 번만 내요.",
      },
      {
        prompt: "땅을 가지고 있는 동안 매년 내는 세금은 ___",
        answer: "b",
        explain:
          "재산세는 매년 6월 1일에 그 땅을 가진 사람에게 나와요.",
      },
      {
        prompt: "6월 1일에 땅 주인이 누구인지에 따라 내는 사람이 정해지는 세금은 ___",
        answer: "b",
        explain:
          "재산세는 6월 1일 기준 주인이 그해 전체 몫을 내요. 그래서 잔금일을 6월 1일 앞뒤로 맞추기도 해요.",
      },
    ],
  },
  {
    id: "cancelled-direct",
    a: { termId: "cancelled", text: "해제거래" },
    b: { termId: "direct", text: "직거래" },
    questions: [
      {
        prompt: "계약했다가 나중에 없던 일이 된 거래는 ___",
        answer: "a",
        explain:
          "해제거래는 신고 뒤 취소된 거래예요. 시세를 볼 때는 빼고 보는 게 좋아요.",
      },
      {
        prompt: "중개사 없이 사는 사람과 파는 사람이 바로 한 거래는 ___",
        answer: "b",
        explain:
          "직거래는 가족 간 거래처럼 시세와 다른 값이 섞일 수 있어 따로 표시해요.",
      },
      {
        prompt: "시세에 넣으면 안 되는, 이미 취소된 거래는 ___",
        answer: "a",
        explain:
          "해제거래는 실제로 거래가 성사되지 않았으니 시세 계산에서 빼요.",
      },
    ],
  },
  {
    id: "median-ppp",
    a: { termId: "median", text: "중위값" },
    b: { termId: "ppp", text: "평당가" },
    questions: [
      {
        prompt: "거래 5건 가격을 줄 세웠을 때 3번째 가격은 ___",
        answer: "a",
        explain:
          "중위값은 딱 가운데 값이라 아주 비싼 거래 한 건에 덜 흔들려요.",
      },
      {
        prompt: "10억 원에 팔린 50평 땅의 2천만 원은 ___",
        answer: "b",
        explain: "평당가는 가격을 평수로 나눈 값이에요. 10억 ÷ 50평 = 2천만 원.",
      },
      {
        prompt: "넓이가 다른 땅끼리 값을 비교할 때 쓰는 건 ___",
        answer: "b",
        explain:
          "평당가로 바꾸면 넓은 땅과 좁은 땅도 같은 기준으로 비교할 수 있어요.",
      },
    ],
  },
];

function pairQuiz(pair: Pair, index: number): Quiz {
  const question = pair.questions[index];
  return {
    kind: "confusable",
    id: `confusable-${pair.id}-${index}`,
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

// 짝 맞추기에서 틀린 용어가 들어 있는 쌍을 먼저 고르고, 없으면 seed로 고른다
export function confusableQuiz(
  seed: string,
  wrongTermIds: string[] = [],
): Quiz {
  const review = CONFUSABLE_PAIRS.filter((p) =>
    [p.a.termId, p.b.termId].some((id) => wrongTermIds.includes(id)),
  );
  const pool = review.length ? review : CONFUSABLE_PAIRS;
  const pair = pool[hash(`${seed}:쌍`) % pool.length];
  return pairQuiz(pair, hash(`${seed}:쌍문제`) % pair.questions.length);
}

export const QUIZ_COUNT = 4;

// 추가 문제를 시작할 때마다 새로 뽑는다.
// - 지도에서 본 땅이 있으면 그 땅 카드를 넣는다
// - 짝 맞추기에서 틀린 용어가 든 쌍 문제를 하나 넣는다
// - 번역하기와 헷갈리는 쌍이 최소 1개씩 들어가고, 같은 문제·같은 쌍은 겹치지 않는다
// - 마지막에 순서를 섞는다
export function randomQuizzes(
  options: {
    parcel?: Parcel | null;
    wrongTermIds?: string[];
    count?: number;
    random?: () => number;
  } = {},
): Quiz[] {
  const random = options.random ?? Math.random;
  const count = options.count ?? QUIZ_COUNT;
  const seed = () => String(random());
  const pick = <T,>(items: T[]) =>
    items.splice(Math.floor(random() * items.length), 1)[0];
  const wrong = options.wrongTermIds ?? [];

  const cards = [...SAMPLE_CARDS];
  const pairs = [...CONFUSABLE_PAIRS];
  const picked: Quiz[] = [];
  const addCard = (card: LandCard, sample: boolean) => {
    const quiz = cardQuiz(card, sample, seed());
    if (quiz) picked.push(quiz);
  };
  const addPair = (pair: Pair) => {
    pairs.splice(pairs.indexOf(pair), 1);
    picked.push(pairQuiz(pair, Math.floor(random() * pair.questions.length)));
  };

  const fromMap = cardFromParcel(options.parcel);
  if (fromMap) addCard(fromMap, false);
  const review = pairs.filter((p) =>
    [p.a.termId, p.b.termId].some((id) => wrong.includes(id)),
  );
  if (review.length) addPair(pick(review));
  if (!picked.some((q) => q.kind === "translate")) addCard(pick(cards), true);
  if (!picked.some((q) => q.kind === "confusable")) addPair(pick([...pairs]));

  // 남은 자리는 샘플 카드와 쌍을 섞은 풀에서 채운다
  const rest: (() => void)[] = [
    ...cards.map((card) => () => addCard(card, true)),
    ...pairs.map((pair) => () => addPair(pair)),
  ];
  while (picked.length < count && rest.length) pick(rest)();

  return shuffle(picked, seed());
}

// 틀린 보기를 골랐을 때 복습에 넣을 용어. 헷갈리는 쌍은 정답 용어를 넣는다
export function missedTermId(quiz: Quiz, choiceId: string) {
  if (choiceId === quiz.answerId) return null;
  if (quiz.kind === "confusable")
    return quiz.choices.find((c) => c.id === quiz.answerId)?.termId ?? null;
  return quiz.choices.find((c) => c.id === choiceId)?.termId ?? null;
}
