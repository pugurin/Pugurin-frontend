import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { WebSearch } from "../src/components/WebSearch";
import type { Repository } from "../src/api/repository";
import type { SearchResult } from "../src/api/types";
afterEach(cleanup);
const complex: SearchResult = {
  type: "complex",
  complex_id: "complex-1",
  name: "해운대 아파트",
  lat: 35.16,
  lng: 129.16,
};
const region: SearchResult = {
  type: "region",
  region_code: "2635010500",
  name: "우동",
  lat: 35.16,
  lng: 129.16,
};
function setup(search = async () => ({ data: [region, complex] })) {
  const onSelect = vi.fn(),
    onClose = vi.fn(),
    onRecent = vi.fn();
  render(
    <WebSearch
      repo={{ search } as unknown as Repository}
      recent={[{ label: "우동", result: region }]}
      onRecent={onRecent}
      onSelect={onSelect}
      onClose={onClose}
    />,
  );
  return { onSelect, onClose, onRecent };
}
describe("웹 검색 드롭다운", () => {
  it("최근 검색을 보여 주고 삭제와 Escape 닫기를 지원한다", () => {
    const { onRecent, onClose } = setup();
    expect(screen.getByRole("option", { name: "우동" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "우동 삭제" }));
    expect(onRecent).toHaveBeenCalledWith([]);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("삭제 버튼에 포커스가 있어도 Escape로 닫는다", () => {
    const { onClose } = setup();
    fireEvent.keyDown(screen.getByRole("button", { name: "우동 삭제" }), {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("검색 결과를 유형별로 묶고 화살표·Enter로 선택한다", async () => {
    const { onSelect, onClose } = setup();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "해운대" } });
    await screen.findByRole("option", { name: "해운대 아파트" });
    expect(screen.getByRole("group", { name: "단지" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "동네" })).toBeTruthy();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "해운대 아파트" }).id,
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(region);
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("늦게 도착한 이전 검색 결과가 새 검색 결과를 덮어쓰지 않는다", async () => {
    let finish: (value: { data: SearchResult[] }) => void = () => {};
    setup(async (query?: string) =>
      query === "첫 검색"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : { data: [complex] },
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "첫 검색" } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    fireEvent.change(input, { target: { value: "새 검색" } });
    await screen.findByRole("option", { name: "해운대 아파트" });
    finish({ data: [region] });
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "우동" })).toBeNull(),
    );
  });
  it("실패를 표시하고 재시도할 수 있다", async () => {
    let fail = true;
    setup(async () => {
      if (fail) throw new Error("검색 연결 실패");
      return { data: [complex] };
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "해운대" },
    });
    await screen.findByText("검색 연결 실패");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("option", { name: "해운대 아파트" });
  });
});
