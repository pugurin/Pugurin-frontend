import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { pickTip, TIP_DELAY_MS } from "../src/glossary/tips";
import { LoadingTip } from "../src/components/LoadingTip";
import { GlossaryContext } from "../src/glossary/context";
import { TERMS } from "../src/api/terms";
import type { Term } from "../src/api/types";

const term = (id: string, category: Term["category"]): Term => ({
  id,
  term: `용어${id}`,
  category,
  is_popular: false,
  display_order: 0,
  short_definition: `${id} 설명`,
  long_definition: "",
  example: "",
});
const terms = [
  term("a", "land"),
  term("b", "land"),
  term("c", "building"),
  term("d", "trade"),
];

describe("팁 고르기", () => {
  it("토지 화면은 토지 용어에서 고른다", () => {
    for (let i = 0; i < 20; i++)
      expect(pickTip(terms, "land", null).category).toBe("land");
  });
  it("단지 화면은 건물·거래 용어에서 고른다", () => {
    for (let i = 0; i < 20; i++)
      expect(["building", "trade"]).toContain(
        pickTip(terms, "complex", null).category,
      );
  });
  it("직전 팁과 겹치지 않게 고른다", () => {
    for (let i = 0; i < 20; i++)
      expect(pickTip(terms, "land", "a").id).toBe("b");
  });
  it("용어 목록을 못 받으면 앱에 넣어 둔 기본 용어에서 고른다", () => {
    expect(TERMS.map((t) => t.id)).toContain(pickTip([], "splash", null).id);
  });
});

describe("로딩 팁 카드", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  it("로딩이 1초를 넘을 때만 보이고, 용어 자세히를 누르면 용어 상세를 연다", () => {
    vi.useFakeTimers();
    const openTerm = vi.fn();
    render(
      <GlossaryContext.Provider
        value={{ terms: [term("c", "building")], openTerm }}
      >
        <LoadingTip context="complex" />
      </GlossaryContext.Provider>,
    );
    expect(screen.queryByText("용어c")).toBeNull();
    act(() => vi.advanceTimersByTime(TIP_DELAY_MS));
    expect(screen.getByText("용어c")).toBeTruthy();
    expect(screen.getByText("c 설명")).toBeTruthy();
    fireEvent.click(screen.getByText("용어 자세히 ›"));
    expect(openTerm).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }));
  });
  it("1초 안에 로딩이 끝나 사라지면 팁이 깜빡이지 않는다", () => {
    vi.useFakeTimers();
    const { unmount } = render(<LoadingTip context="splash" linked={false} />);
    act(() => vi.advanceTimersByTime(TIP_DELAY_MS - 1));
    expect(screen.queryByText("알아 두면 좋은 용어")).toBeNull();
    unmount();
  });
  it("스플래시 팁은 누를 수 없다", () => {
    vi.useFakeTimers();
    render(<LoadingTip context="splash" terms={[]} linked={false} />);
    act(() => vi.advanceTimersByTime(TIP_DELAY_MS));
    expect(screen.getByText("알아 두면 좋은 용어")).toBeTruthy();
    expect(screen.queryByText("용어 자세히 ›")).toBeNull();
  });
});
