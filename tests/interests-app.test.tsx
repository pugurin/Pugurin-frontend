import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "../App";

// 관심 등록과 로그인(App): 로그인 안내 시트, 세션 만료, 토큰을 붙이는 요청
vi.mock("expo-font", () => ({ useFonts: () => [true] }));
vi.mock("expo-location", () => ({}));
const storage = vi.hoisted(() => ({
  store: null as any,
  values: {} as Record<string, unknown>,
}));
vi.mock("../src/state/storage", async () => {
  const { vi } = await import("vitest");
  storage.store = vi.fn(async () => {});
  return {
    deviceId: async () => "device-1",
    loadStored: async (k: string, fallback: unknown) =>
      k in storage.values ? storage.values[k] : fallback,
    store: storage.store,
    remember: (list: unknown[]) => list,
  };
});
vi.mock("../src/glossary/matching", () => ({
  loadMatchingRecord: async () => null,
  matchingStatus: () => undefined,
}));
vi.mock("../src/screens/MapHome", () => ({ MapHome: () => <div>지도</div> }));
vi.mock("../src/map/MapCanvas", () => ({ default: () => null }));

const user = {
  id: "u1",
  nickname: "부산사람",
  provider: "kakao",
  role: "buyer",
  marketing_push: false,
  created_at: "2026-11-17T10:00:00+09:00",
};
const session = { source: "api", user, access_token: "a1", refresh_token: "" };
// 실제 서버 인증 대역. 저장한 세션은 되살리고, 데이터 API의 갱신은 만료(401)로 끝난다
const auth = vi.hoisted(() => ({ refreshAccess: null as any }));
vi.mock("../src/api/apiAuth", async () => {
  const { vi } = await import("vitest");
  const { ApiError } = await import("../src/api/client");
  auth.refreshAccess = vi.fn(async () => {
    throw new ApiError("다시 로그인해 주세요", "UNAUTHORIZED");
  });
  return {
    ApiAuth: class {
      readonly source = "api";
      completeSignIn = async () => null;
      restore = async () => session;
      accessToken = () => "a1";
      refreshAccess = (used?: string) => auth.refreshAccess(used);
    },
  };
});

type Seen = { url: string; authorization: string | null };
let seen: Seen[] = [];
beforeEach(() => {
  storage.values = {};
  storage.store.mockClear();
  auth.refreshAccess.mockClear();
  seen = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get("Authorization");
      seen.push({ url, authorization });
      if (url.includes("/interests"))
        return new Response(
          JSON.stringify({
            error: { code: "UNAUTHORIZED", message: "인증이 필요합니다" },
          }),
          { status: 401 },
        );
      return new Response(JSON.stringify({ data: [], meta: {} }));
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.EXPO_PUBLIC_AUTH_MODE;
});

describe("관심 등록 로그인(App)", () => {
  it("로그인하지 않고 관심 단지를 열면 로그인 안내 시트(A1)를 띄우고, 나중에 할게요로 닫는다", async () => {
    process.env.EXPO_PUBLIC_AUTH_MODE = "sample";
    render(<App />);
    fireEvent.click(await screen.findByText("더보기"));
    fireEvent.click(await screen.findByText("관심 단지"));
    expect(
      await screen.findByText("관심 단지는 로그인하면 저장돼요"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "카카오로 시작하기" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "나중에 할게요" }));
    await waitFor(() =>
      expect(screen.queryByText("관심 단지는 로그인하면 저장돼요")).toBeNull(),
    );
  });

  it("관심 목록 요청이 401이고 갱신도 만료로 끝나면 세션을 지우고 다시 로그인하라고 띄운다", async () => {
    process.env.EXPO_PUBLIC_AUTH_MODE = "api";
    storage.values.session = { source: "api", user };
    render(<App />);
    expect(await screen.findByText("로그인이 끝났어요")).toBeTruthy();
    expect(auth.refreshAccess).toHaveBeenCalledWith("a1");
    expect(storage.store).toHaveBeenCalledWith("session", null);
    // 관심 목록에는 토큰을 붙이고, 공개 요청(용어집)에는 붙이지 않는다
    expect(seen.find((s) => s.url.endsWith("/interests"))?.authorization).toBe(
      "Bearer a1",
    );
    expect(
      seen.find((s) => s.url.endsWith("/glossary"))?.authorization,
    ).toBeNull();
  });
});
