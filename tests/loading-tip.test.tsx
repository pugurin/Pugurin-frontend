import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { LoadingTip } from "../src/components/LoadingTip";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("빠른 로딩은 팁을 띄우지 않고 1초 넘을 때만 나타난다", () => {
  vi.useFakeTimers();
  render(<LoadingTip loading context="complex" />);
  act(() => vi.advanceTimersByTime(999));
  expect(screen.queryByText("불러오는 동안")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByText("불러오는 동안")).toBeTruthy();
});
it("로딩 종료와 실패 때 팁을 즉시 지운다", () => {
  vi.useFakeTimers();
  const { rerender } = render(<LoadingTip loading context="complex" />);
  act(() => vi.advanceTimersByTime(1000));
  rerender(<LoadingTip loading context="complex" error />);
  expect(screen.queryByText("불러오는 동안")).toBeNull();
  rerender(<LoadingTip loading={false} context="complex" />);
  expect(screen.queryByText("불러오는 동안")).toBeNull();
});

it("꺼둔 로딩 팁은 스플래시에서도 나타나지 않는다", () => {
  vi.useFakeTimers();
  render(
    <LoadingTip loading context="all" enabled={false} clickable={false} />,
  );
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.queryByText("불러오는 동안")).toBeNull();
});
