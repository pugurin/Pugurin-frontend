import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { SearchScreen } from "../src/screens/SearchScreen";
import { groupResults } from "../src/state/search";
import type { Repository } from "../src/api/repository";
import type { SearchResult } from "../src/api/types";
afterEach(cleanup);

const at = { lat: 35.16, lng: 129.16 };
const results: SearchResult[] = [
  { type: "complex", name: "연산자이", complex_id: "c1", ...at },
  { type: "address", address: "부산 연제구 연산동 1", ...at },
  { type: "station", name: "연산역 1호선", ...at },
  { type: "region", name: "연산동", region_code: "2647010200", ...at },
  { type: "complex", name: "연산롯데캐슬", complex_id: "c2", ...at },
  // 앱이 학교 목록에서 찾아 맨 뒤에 붙인 학교
  { type: "school", name: "연산초등학교", ...at },
];

describe("검색 결과 묶음 순서", () => {
  it("동네 → 지하철역 → 학교 → 단지 → 주소로 묶고, 묶음 안에서는 받은 순서를 지킨다", () => {
    expect(groupResults(results).map((r) => r.name ?? r.address)).toEqual([
      "연산동",
      "연산역 1호선",
      "연산초등학교",
      "연산자이",
      "연산롯데캐슬",
      "부산 연제구 연산동 1",
    ]);
  });

  it("앱 검색 화면도 같은 순서로 보여 준다", async () => {
    const repo = {
      search: async () => ({ data: results }),
    } as unknown as Repository;
    render(
      <SearchScreen
        repo={repo}
        recent={[]}
        onRecent={() => {}}
        onSelect={() => {}}
        onBack={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("단지·동네·학교 검색"), {
      target: { value: "연산" },
    });
    await screen.findByText("연산동", undefined, { timeout: 3000 });
    const shown = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => results.some((r) => t.includes((r.name ?? r.address)!)));
    expect(
      shown.map(
        (t) =>
          t.replace(/^(동네|지하철역|학교|단지|주소)/, "").split("부산")[0],
      ),
    ).toEqual([
      "연산동",
      "연산역 1호선",
      "연산초등학교",
      "연산자이",
      "연산롯데캐슬",
      "",
    ]);
  });
});
