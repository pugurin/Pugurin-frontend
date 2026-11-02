import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";

vi.mock("expo-font", () => ({ useFonts: () => [true] }));
// 기기 저장소 목: schools만 저장해 둔 값(true)을 돌려주고, 저장 호출을 기록한다
const storage = vi.hoisted(() => ({
  store: null as any,
}));
vi.mock("../src/state/storage", async () => {
  const { vi } = await import("vitest");
  storage.store = vi.fn(async () => {});
  return {
    deviceId: async () => "device-1",
    loadStored: async (k: string, fallback: unknown) =>
      k === "schools" ? true : fallback,
    store: storage.store,
    remember: (list: unknown[]) => list,
  };
});
vi.mock("../src/glossary/matching", () => ({
  loadMatchingRecord: async () => null,
  matchingStatus: () => undefined,
}));
// MapHome 목: 학교 스위치 상태를 보여 주고, 버튼으로 끈다
vi.mock("../src/screens/MapHome", () => ({
  MapHome: (props: any) => (
    <div>
      <p data-testid="schools">{String(props.schools)}</p>
      <button onClick={() => props.onSchools(false)}>학교 끄기</button>
    </div>
  ),
}));

afterEach(cleanup);

describe("App의 학교 레이어 저장", () => {
  it("저장소에 schools=true가 있으면 켜진 채로 그리고, 끄면 store('schools', false)", async () => {
    render(<App />);
    expect((await screen.findByText("true")).dataset.testid).toBe("schools");
    fireEvent.click(screen.getByText("학교 끄기"));
    expect(storage.store).toHaveBeenCalledWith("schools", false);
    expect(screen.getByTestId("schools").textContent).toBe("false");
  });
});
