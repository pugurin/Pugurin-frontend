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
