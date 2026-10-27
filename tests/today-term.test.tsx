import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { kstDateKey, pickToday, todayLabel } from "../src/glossary/today";
import { MapHome } from "../src/screens/MapHome";
import { TodayTermCard } from "../src/components/TodayTermCard";
import { GlossaryScreen } from "../src/screens/GlossaryScreen";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";
import type { Term } from "../src/api/types";
vi.mock("expo-location", () => ({}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
// 지도는 버튼으로 대신한다: 부산으로 이동 / 구 마커 누르기(시트 열림)
vi.mock("../src/map/MapCanvas", () => ({
  default: ({ onEvent }: any) => (
    <>
      <button
        onClick={() =>
          onEvent({
            type: "camera",
            lat: 35.16,
            lng: 129.16,
            zoom: 11,
            bbox: [129.0, 35.1, 129.3, 35.3],
          })
        }
      >
        부산으로 이동
      </button>
      <button onClick={() => onEvent({ type: "marker", id: "26350" })}>
        해운대구 누르기
      </button>
    </>
  ),
}));

const term = (id: string, popular: boolean, order = 0): Term => ({
  id,
  term: `용어${id}`,
  category: "building",
  is_popular: popular,
  display_order: order,
  short_definition: `${id} 한 줄 설명`,
  long_definition: "",
  example: "",
});

describe("오늘의 용어 고르기", () => {
  it("한국 시간 자정에 날짜가 바뀐다", () => {
    expect(kstDateKey(new Date("2026-10-11T14:59:59Z"))).toBe("2026-10-11");
    expect(kstDateKey(new Date("2026-10-11T15:00:00Z"))).toBe("2026-10-12");
    expect(todayLabel("2026-10-11")).toBe("10월 11일");
  });
  it("같은 날이면 같은 용어, 다음 날이면 다음 용어", () => {
    const terms = [term("a", true, 1), term("b", true, 2), term("c", true, 3)];
    expect(pickToday(terms, "2026-10-11")).toBe(pickToday(terms, "2026-10-11"));
    const ids = ["2026-10-11", "2026-10-12", "2026-10-13"].map(
      (d) => pickToday(terms, d)!.id,
    );
    expect(new Set(ids).size).toBe(3);
  });
  it("자주 찾는 용어에서만 고르고, 용어가 없으면 고르지 않는다", () => {
    const terms = [term("a", true), term("b", false), term("c", false)];
    for (const d of ["2026-10-11", "2026-10-12", "2026-10-13"])
      expect(pickToday(terms, d)!.id).toBe("a");
    expect(pickToday([], "2026-10-11")).toBeNull();
  });
});

function setupMap(onToday?: () => void) {
  const markers = vi.fn(async () => ({
    data: { level: "sigungu", markers: [] },
    meta: {},
  }));
  render(
    <MapHome
      repo={{ mode: "api", markers } as unknown as Repository}
      filters={DEFAULT_FILTERS}
      onFilters={() => {}}
      onSearch={() => {}}
      onFilter={() => {}}
      onList={() => {}}
      onDate={() => {}}
      unit="평"
      onUnit={() => {}}
      base="normal"
      onBase={() => {}}
      cadastral={false}
      onCadastral={() => {}}
      onHelp={() => {}}
      notify={() => {}}
      onMeta={() => {}}
      onToday={onToday}
    />,
  );
}

describe("지도 화면의 오늘의 용어", () => {
  afterEach(cleanup);
  it("카드는 지도에 없고, 헤더 버튼으로 짝 맞추기에 들어간다", () => {
    const onToday = vi.fn();
    setupMap(onToday);
    expect(screen.queryByText(/단어 5개 짝 맞추기/)).toBeNull();
    fireEvent.click(screen.getByLabelText("오늘의 용어"));
    expect(onToday).toHaveBeenCalled();
  });
  it("광고 영역을 그리지 않는다", () => {
    setupMap();
    expect(screen.queryByText(/광고 영역/)).toBeNull();
  });
});
describe("오늘의 용어 카드 진행 표시", () => {
  const card = (props: { matched?: number; completed?: boolean }) =>
    render(
      <TodayTermCard
        term={term("1", true)}
        onOpen={() => {}}
        onClose={() => {}}
        {...props}
      />,
    );
  it("진행 중이면 '이어서'와 진행 수를 보여준다", () => {
    card({ matched: 2 });
    expect(screen.getByLabelText("오늘의 용어 짝 맞추기 이어서")).toBeTruthy();
    expect(screen.getByText("이어서")).toBeTruthy();
    expect(screen.getByText("단어 5개 짝 맞추기 · 2/5")).toBeTruthy();
  });
  it("0/5는 '시작', 완료는 '결과'", () => {
    card({ matched: 0 });
    expect(screen.getByText("시작")).toBeTruthy();
    cleanup();
    card({ matched: 5, completed: true });
    expect(screen.getByText("결과")).toBeTruthy();
  });
});

// 지도 카드를 닫아도 용어 탭에서 짝 맞추기를 다시 시작할 수 있다 (#102)
describe("용어 탭의 오늘의 용어 입구", () => {
  afterEach(cleanup);
  const glossary = (onToday = vi.fn()) => {
    cleanup();
    render(
      <GlossaryScreen
        terms={[term("1", true)]}
        loading={false}
        error={null}
        onRetry={() => {}}
        onTerm={() => {}}
        today={{ streak: 0, completed: false, matched: 0 }}
        onToday={onToday}
      />,
    );
    return onToday;
  };
  it("닫기 없이 짝 맞추기를 시작한다", () => {
    const onToday = glossary();
    expect(screen.queryByLabelText("오늘의 용어 닫기")).toBeNull();
    fireEvent.click(screen.getByLabelText("오늘의 용어 짝 맞추기 시작"));
    expect(onToday).toHaveBeenCalledTimes(1);
  });
  it("검색 중에는 숨긴다", () => {
    glossary();
    fireEvent.change(screen.getByPlaceholderText("궁금한 용어를 검색하세요"), {
      target: { value: "용어" },
    });
    expect(screen.queryByLabelText("오늘의 용어 짝 맞추기 시작")).toBeNull();
  });
});
