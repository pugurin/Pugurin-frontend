import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { DEFAULT_TIPS, pickTip, TIP_DELAY_MS } from "../src/glossary/tips";
import { LoadingTip } from "../src/components/LoadingTip";
import { Splash } from "../src/components/Splash";
import { ComplexContent } from "../src/screens/MarketSheets";
import { DEFAULT_FILTERS } from "../src/state/market";
import { GlossaryContext } from "../src/glossary/context";
import { TERMS } from "../src/api/terms";
import type { Term } from "../src/api/types";
vi.mock("../src/components/Chart", () => ({ Chart: () => null }));

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
  it("용어 목록을 못 받으면 기본 팁 10개에서 고른다", () => {
    expect(DEFAULT_TIPS).toHaveLength(10);
    expect(DEFAULT_TIPS.every((t) => TERMS.includes(t))).toBe(true);
    for (let i = 0; i < 20; i++)
      expect(DEFAULT_TIPS.map((t) => t.id)).toContain(
        pickTip([], "splash", null).id,
      );
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

describe("스플래시 (T01)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  it("앱 이름·안내를 보여주고 1초 넘으면 누를 수 없는 팁이 나온다", () => {
    vi.useFakeTimers();
    render(<Splash />);
    expect(screen.getByText("부산 실거래가 지도")).toBeTruthy();
    expect(screen.getByText("실거래가를 불러오고 있어요")).toBeTruthy();
    expect(screen.queryByText("알아 두면 좋은 용어")).toBeNull();
    act(() => vi.advanceTimersByTime(TIP_DELAY_MS));
    expect(screen.getByText("알아 두면 좋은 용어")).toBeTruthy();
    expect(screen.queryByText("용어 자세히 ›")).toBeNull();
  });
});

describe("단지 시트 로딩 실패 (T03)", () => {
  afterEach(cleanup);
  it("팁 없이 안내와 다시 시도만 보여준다", async () => {
    const repo: any = {
      mode: "api",
      complex: async () => {
        throw new Error("네트워크에 연결할 수 없어요");
      },
      transactions: async () => ({ data: [] }),
      stats: async () => ({ data: null }),
      analysis: async () => ({ data: null }),
    };
    render(
      <ComplexContent
        id="c"
        repo={repo}
        filters={DEFAULT_FILTERS}
        stage="peek"
        onStage={() => {}}
        onHelp={() => {}}
        notify={() => {}}
        unit="평"
      />,
    );
    expect(
      await screen.findByText("단지 정보를 불러오지 못했어요"),
    ).toBeTruthy();
    expect(
      screen.getByText("인터넷 연결을 확인하고 다시 시도해 주세요."),
    ).toBeTruthy();
    expect(screen.getByText("다시 시도")).toBeTruthy();
    expect(screen.queryByText("불러오는 동안")).toBeNull();
  });
});
