import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";
import type { Filters, Property } from "../src/api/types";
vi.mock("expo-location", () => ({}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: ({ id }: { id: string }) => <p>단지 패널 {id}</p>,
  RegionContent: () => null,
}));
vi.mock("../src/map/MapCanvas", () => ({ default: () => null }));
afterEach(cleanup);
// 앱에서처럼 렌더마다 새로 만들지 않는 focus
const focus = {
  nonce: 1,
  result: {
    type: "complex" as const,
    complex_id: "c1",
    lat: 35.16,
    lng: 129.16,
  },
};

function setup(propertyType: Property) {
  const notify = vi.fn();
  const changes: Filters[] = [];
  const repo = {
    mode: "api",
    markers: vi.fn(async () => ({ data: { markers: [] }, meta: {} })),
    complex: vi.fn(async () => ({
      data: { id: "c1", property_type: propertyType },
    })),
  } as unknown as Repository;
  function Host() {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    return (
      <MapHome
        repo={repo}
        filters={filters}
        onFilters={(f) => {
          changes.push(f);
          setFilters(f);
        }}
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
        notify={notify}
        onMeta={() => {}}
        focus={focus}
      />
    );
  }
  render(<Host />);
  return { notify, changes };
}

describe("검색으로 단지를 고르면", () => {
  it("다른 유형 단지면 유형 탭을 그 유형으로 바꾸고 단지 패널은 유지한다", async () => {
    const { notify, changes } = setup("officetel");
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("오피스텔 탭으로 바꿨어요"),
    );
    expect(changes.at(-1)?.property_type).toBe("officetel");
    // 탭이 바뀐 뒤 렌더가 끝나도 단지 패널이 닫히지 않아야 한다
    await act(async () => {});
    expect(screen.getByText("단지 패널 c1")).toBeTruthy();
  });
  it("같은 유형이면 탭을 바꾸지 않는다", async () => {
    const { notify, changes } = setup("apartment");
    await screen.findByText("단지 패널 c1");
    await new Promise((r) => setTimeout(r, 0));
    expect(changes).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });
});
