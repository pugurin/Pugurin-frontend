import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { kstDateKey, pickToday, todayLabel } from "../src/glossary/today";
import { MapHome } from "../src/screens/MapHome";
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

function setup(todayTerm: Term | null) {
  const onTodayOpen = vi.fn();
  const onTodayClose = vi.fn();
  const markers = vi.fn(async () => ({
    data: {
      level: "sigungu",
      markers: [
        {
          kind: "region",
          region_code: "26350",
          name: "해운대구",
          lat: 35.16,
          lng: 129.16,
          transaction_count: 10,
          summary: { median_price_per_pyeong: 30000000 },
        },
      ],
    },
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
      todayTerm={todayTerm}
      onTodayOpen={onTodayOpen}
      onTodayClose={onTodayClose}
    />,
  );
  return { onTodayOpen, onTodayClose, markers };
}

describe("오늘의 용어 카드", () => {
  afterEach(cleanup);
  it("카드를 누르면 용어 상세, ✕를 누르면 닫기", () => {
    const { onTodayOpen, onTodayClose } = setup(term("a", true));
    expect(screen.getByText("a 한 줄 설명")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("오늘의 용어 용어a 자세히 보기"));
    expect(onTodayOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a" }),
    );
    fireEvent.click(screen.getByLabelText("오늘의 용어 닫기"));
    expect(onTodayClose).toHaveBeenCalled();
  });
  it("오늘의 용어가 없으면(꺼짐·오늘 닫음·용어 없음) 카드를 보여주지 않는다", () => {
    setup(null);
    expect(screen.queryByLabelText("오늘의 용어 닫기")).toBeNull();
  });
  it("시트가 열리면 카드를 숨긴다", async () => {
    const { markers } = setup(term("a", true));
    fireEvent.click(screen.getByText("부산으로 이동"));
    await waitFor(() => expect(markers).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 300));
    fireEvent.click(screen.getByText("해운대구 누르기"));
    await waitFor(() =>
      expect(screen.queryByLabelText("오늘의 용어 닫기")).toBeNull(),
    );
  });
});
