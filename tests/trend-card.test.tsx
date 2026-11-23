import React from "react";
import { it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  TrendCard,
  smoothPath,
  niceTicks,
  monthTicks,
} from "../src/components/TrendCard";
vi.mock("react-native-svg", () => ({
  default: ({ accessibilityLabel, ...p }: any) => (
    <svg aria-label={accessibilityLabel} {...p} />
  ),
  Path: (p: any) => <path {...p} />,
  Circle: (p: any) => <circle {...p} />,
  Line: (p: any) => <line {...p} />,
  Text: ({ textAnchor, ...p }: any) => <text {...p} />,
  Defs: (p: any) => <defs {...p} />,
  LinearGradient: (p: any) => <linearGradient {...p} />,
  Stop: (p: any) => <stop {...p} />,
}));
afterEach(cleanup);

const months = (n: number, f: (i: number) => number | null) =>
  Array.from({ length: n }, (_, i) => ({
    month: `20${24 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    count: 5,
    median_price_per_pyeong: f(i),
  }));

it("최근값을 크게, 기간 시작 대비 상승폭과 비율을 보여 준다", () => {
  render(<TrendCard trend={months(36, (i) => 50_000_000 + i * 1_000_000)} />);
  expect(screen.getByText("8,500만원")).toBeTruthy();
  expect(document.body.textContent).toContain("▲ 3,500만원 (+70.0%)");
  expect(document.body.textContent).toContain("3년 전 대비");
  expect(document.body.textContent).toContain("최고 8,500만");
  expect(document.body.textContent).toContain("최저 5,000만");
});

it("기간을 1년으로 바꾸면 1년 전 대비로 다시 계산한다", () => {
  render(<TrendCard trend={months(36, (i) => 50_000_000 + i * 1_000_000)} />);
  fireEvent.click(screen.getByText("1년"));
  expect(document.body.textContent).toContain("▲ 1,100만원 (+14.9%)");
  expect(document.body.textContent).toContain("1년 전 대비");
});

it("내리면 파란 ▼로 표시한다", () => {
  render(<TrendCard trend={months(12, (i) => 60_000_000 - i * 1_000_000)} />);
  expect(document.body.textContent).toContain("▼ 1,100만원 (-18.3%)");
});

it("값이 없는 달은 건너뛰고 한 줄로 이어 그린다", () => {
  const { container } = render(
    <TrendCard
      trend={months(6, (i) => (i === 2 || i === 4 ? null : 5e7 + i * 1e6))}
    />,
  );
  const strokes = [...container.querySelectorAll("path")].filter(
    (p) => p.getAttribute("fill") === "none",
  );
  expect(strokes).toHaveLength(1);
  // 남은 4달이 모두 한 선에: M + C 3번
  expect(strokes[0].getAttribute("d")!.match(/C/g)).toHaveLength(3);
});

it("통계가 하나도 없으면 안내 문구", () => {
  render(<TrendCard trend={months(6, () => null)} />);
  expect(screen.getByText("이 기간에는 표시할 통계가 없어요")).toBeTruthy();
});

it("단조 보간은 점을 모두 지나는 곡선을 만든다", () => {
  const d = smoothPath([
    { x: 0, y: 10 },
    { x: 10, y: 0 },
    { x: 20, y: 5 },
  ]);
  expect(d.startsWith("M0,10")).toBe(true);
  expect(d).toContain(" 10,0");
  expect(d.endsWith(" 20,5")).toBe(true);
});

it("x축은 시간(거래 월), y축은 가격 눈금으로 그린다", () => {
  const { container } = render(
    <TrendCard trend={months(36, (i) => 50_000_000 + i * 1_000_000)} />,
  );
  const texts = [...container.querySelectorAll("text")].map(
    (t) => t.textContent,
  );
  expect(texts).toContain("가격(원)");
  expect(texts).toContain("시간(거래 월) →");
  // x축 처음·끝 월
  expect(texts).toContain("24.01");
  expect(texts).toContain("26.12");
  // y축 눈금은 금액
  expect(
    texts.filter((t) => /^[\d,.]+(만|억)$/.test(t ?? "")).length,
  ).toBeGreaterThanOrEqual(3);
});

it("눈금 계산: 가격은 보기 좋은 간격, 월은 처음과 끝 포함", () => {
  expect(niceTicks(42_000_000, 56_000_000)).toEqual([
    40_000_000, 45_000_000, 50_000_000, 55_000_000, 60_000_000,
  ]);
  expect(monthTicks(36)).toEqual([0, 9, 18, 27, 35]);
  expect(monthTicks(6)).toEqual([0, 2, 4, 5]);
});
