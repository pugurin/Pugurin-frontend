import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";

// App에서 관심 기능이 어떻게 연결되는지 본다: 더보기 줄, 로그인 유도, 탈퇴 시 삭제
vi.mock("expo-font", () => ({ useFonts: () => [true] }));
vi.mock("expo-location", () => ({}));
vi.mock("../src/state/storage", () => ({
  deviceId: async () => "device-1",
  loadStored: async (_k: string, fallback: unknown) => fallback,
  store: async () => {},
  remember: (list: unknown[]) => list,
}));
vi.mock("../src/glossary/matching", () => ({
  loadMatchingRecord: async () => null,
  matchingStatus: () => undefined,
}));
vi.mock("../src/screens/MapHome", () => ({ MapHome: () => null }));
vi.mock("../src/components/Sheet", () => ({ Sheet: () => null }));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
vi.mock("../src/map/MapCanvas", () => ({ default: () => null }));
const session = {
  source: "sample",
  user: { id: "u1", nickname: "부산사람", provider: "kakao", role: "buyer", marketing_push: false, created_at: "2026-11-13" },
  access_token: "a",
  refresh_token: "r",
};
// 로그인·내 정보 화면은 버튼 하나로 줄인다
vi.mock("../src/screens/AuthScreens", () => ({
  LoginScreen: ({ onSession }: any) => <button onClick={() => onSession(session)}>가짜 로그인</button>,
  SignupScreen: () => null,
  AccountScreen: ({ onSignedOut }: any) => <button onClick={() => onSignedOut(true)}>탈퇴하기</button>,
}));
// 관심 샘플 서버는 호출만 기록한다
const interests = vi.hoisted(() => ({ created: [] as any[], clear: null as any }));
vi.mock("../src/api/interests", async (orig) => {
  const { vi } = await import("vitest");
  interests.clear = vi.fn(async () => {});
  return {
    ...(await orig<typeof import("../src/api/interests")>()),
    SampleInterests: class {
      constructor(opts: unknown) {
        interests.created.push(opts);
      }
      listComplexes = async () => [];
      listRegions = async () => [];
      clear = interests.clear;
    },
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  interests.created = [];
  interests.clear?.mockClear();
});
const flush = () => act(() => new Promise((r) => setTimeout(r, 20)));
async function openMore() {
  render(<App />);
  await flush();
  fireEvent.click(screen.getAllByText("더보기").at(-1)!);
  await flush();
}

describe("App의 관심 연결", () => {
  it("로그인을 열지 않은 운영 빌드에서는 관심 서버를 만들지 않고 더보기에 관심 목록 줄도 없다", async () => {
    vi.stubEnv("EXPO_PUBLIC_AUTH_MODE", "");
    await openMore();
    expect(interests.created).toHaveLength(0);
    expect(screen.queryByText("관심 목록")).toBeNull();
  });

  it("샘플 로그인 빌드에서는 관심 목록 줄이 로그인으로 이끌고, 탈퇴하면 관심도 지운다", async () => {
    vi.stubEnv("EXPO_PUBLIC_AUTH_MODE", "sample");
    await openMore();
    // 데이터 모드별로 저장하도록 지금 모드를 넘긴다
    expect(interests.created.at(-1)).toMatchObject({ scope: expect.stringMatching(/^(api|sample)$/) });
    fireEvent.click(screen.getByText("관심 목록"));
    await flush();
    expect(screen.getByText("로그인하면 관심 목록을 볼 수 있어요")).toBeTruthy();
    fireEvent.click(screen.getByText("가짜 로그인"));
    await flush();
    fireEvent.click(screen.getByText("부산사람"));
    await flush();
    fireEvent.click(screen.getByText("탈퇴하기"));
    await flush();
    expect(interests.clear).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: "u1" }) }));
  });
});
