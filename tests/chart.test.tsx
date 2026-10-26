import React from "react";
import { it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Chart } from "../src/components/Chart";
vi.mock("react-native-svg", () => ({
  default: ({ accessibilityLabel, ...p }: any) => (
    <svg aria-label={accessibilityLabel} {...p} />
  ),
  Path: (p: any) => <path {...p} />,
  Circle: (p: any) => <circle {...p} />,
  Line: (p: any) => <line {...p} />,
  Rect: (p: any) => <rect {...p} />,
  Text: ({ textAnchor, ...p }: any) => <text {...p} />,
}));
afterEach(cleanup);
it("null 사이 고립된 유효 월세 통계도 점으로 표시한다", () => {
  const { container } = render(
    <Chart
      metric="median_monthly_rent"
      trend={[
        { month: "2026-07", count: 1, median_monthly_rent: null },
        { month: "2026-08", count: 3, median_monthly_rent: 900000 },
        { month: "2026-09", count: 0, median_monthly_rent: null },
      ]}
    />,
  );
  expect(container.querySelectorAll("circle").length).toBe(1);
  expect(container.textContent).toContain("월세 중위값");
  const path = container.querySelector("path")?.getAttribute("d");
  expect(path).not.toContain("L");
});
it("x·y축이 무엇인지와 y축 눈금 금액을 표시한다", () => {
  const { container } = render(
    <Chart
      trend={[
        { month: "2026-07", count: 5, median_price_per_pyeong: 50_000_000 },
        { month: "2026-08", count: 5, median_price_per_pyeong: 60_000_000 },
      ]}
    />,
  );
  expect(container.textContent).toContain("↑ 평당가 (중위값)");
  expect(container.textContent).toContain("거래 월 →");
  const ticks = [...container.querySelectorAll("text")].map(
    (t) => t.textContent,
  );
  expect(ticks).toHaveLength(3);
  ticks.forEach((t) => expect(t).toMatch(/만$/));
});
it("비교선이 있으면 그래프와 같은 선 모양으로 범례를 그린다", () => {
  const trend = [
    { month: "2026-07", count: 5, median_price_per_pyeong: 50_000_000 },
    { month: "2026-08", count: 5, median_price_per_pyeong: 60_000_000 },
  ];
  const { container } = render(
    <Chart
      trend={trend}
      comparison={trend.map((t) => ({
        ...t,
        median_price_per_pyeong: 40_000_000,
      }))}
    />,
  );
  expect(container.textContent).toContain("이 단지");
  expect(container.textContent).toContain("해당 지역 전체");
  expect(container.textContent).not.toContain("┅");
  const dashedSwatch = [...container.querySelectorAll("line")].filter(
    (l) => l.getAttribute("stroke-dasharray") === "5 4",
  );
  expect(dashedSwatch).toHaveLength(1);
});
