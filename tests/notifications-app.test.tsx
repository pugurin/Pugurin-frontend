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

// 알림함과 로그인(App): 알림함에서 로그인 시트로 로그인하면 알림함으로 돌아온다
vi.mock("expo-font", () => ({ useFonts: () => [true] }));
vi.mock("expo-location", () => ({}));
const storage = vi.hoisted(() => ({ values: {} as Record<string, unknown> }));
vi.mock("../src/state/storage", () => ({
  deviceId: async () => "device-1",
  loadStored: async (k: string, fallback: unknown) =>
    k in storage.values ? storage.values[k] : fallback,
  store: async (k: string, v: unknown) => {
    storage.values[k] = v;
  },
  remember: (list: unknown[]) => list,
}));
vi.mock("../src/glossary/matching", () => ({
  loadMatchingRecord: async () => null,
  matchingStatus: () => undefined,
}));
vi.mock("../src/screens/MapHome", () => ({ MapHome: () => <div>지도</div> }));
vi.mock("../src/map/MapCanvas", () => ({ default: () => null }));

beforeEach(() => {
  // 샘플 인증에 이미 가입한 카카오 계정이 있어 로그인하면 바로 세션이 나온다
  storage.values = {
    sample_auth_accounts: [
      {
        provider: "kakao",
        user: {
          id: "sample-user-kakao",
          nickname: "부산사람",
          provider: "kakao",
          role: "buyer",
          marketing_push: false,
          created_at: "2026-11-17T10:00:00+09:00",
        },
      },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: [], meta: {} }))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.EXPO_PUBLIC_AUTH_MODE;
});

describe("알림함 로그인(App)", () => {
  it("로그아웃 상태로 알림함에서 로그인하면 알림함에 그대로 남아 목록을 보인다", async () => {
    process.env.EXPO_PUBLIC_AUTH_MODE = "sample";
    render(<App />);
    fireEvent.click(await screen.findByText("더보기"));
    fireEvent.click(await screen.findByText("알림"));
    fireEvent.click(await screen.findByText("로그인"));
    fireEvent.click(
      await screen.findByRole("button", { name: "카카오로 시작하기" }),
    );
    // 샘플 로그인은 알림을 앱 안 샘플로 보여 준다
    expect(
      await screen.findByText(
        "관심 단지 주간 리포트 · 11/16~11/22",
        {},
        { timeout: 3000 },
      ),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText("로그인하면 주간 리포트를 받아요")).toBeNull(),
    );
  });
});
