import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "../App";

// 실제 서버 인증(웹)으로 켠다. makeAuth는 App이 처음 그릴 때 이 값을 읽는다
process.env.EXPO_PUBLIC_AUTH_MODE = "api";

// 글꼴은 테스트가 정한 때에 준비된다
const fonts = vi.hoisted(() => ({ ready: false }));
vi.mock("expo-font", () => ({ useFonts: () => [fonts.ready] }));
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
vi.mock("../src/components/Sheet", () => ({
  Sheet: ({ children }: any) => <aside>{children}</aside>,
}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
vi.mock("../src/map/MapCanvas", () => ({ default: () => null }));

const user = {
  id: "u1",
  nickname: "부산사람",
  provider: "google",
  role: "buyer",
  marketing_push: false,
  created_at: "2026-11-17T10:00:00+09:00",
};
const session = { source: "api", user, access_token: "a1", refresh_token: "" };
// 실제 서버 대역: 소셜 로그인에서 막 돌아온 상태
const auth = vi.hoisted(() => ({
  completeSignIn: null as any,
  restore: null as any,
}));
vi.mock("../src/api/apiAuth", async () => {
  const { vi } = await import("vitest");
  auth.completeSignIn = vi.fn();
  auth.restore = vi.fn();
  return {
    ApiAuth: class {
      readonly source = "api";
      // 실제처럼 콜백 주소를 바로 첫 화면으로 되돌린다
      completeSignIn = () => {
        window.history.replaceState(null, "", "/");
        return auth.completeSignIn();
      };
      restore = (...a: unknown[]) => auth.restore(...a);
    },
  };
});

beforeEach(() => {
  fonts.ready = false;
  storage.values = {};
  storage.store.mockClear();
  auth.completeSignIn
    .mockReset()
    .mockResolvedValue({ kind: "session", session });
  auth.restore.mockReset().mockRejectedValue(new Error("복원하면 안 된다"));
  window.history.replaceState(null, "", "/auth/callback?code=c&state=s");
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("소셜 로그인에서 돌아왔을 때(App)", () => {
  it("글꼴이 늦게 준비돼도 로그인 결과를 버리지 않는다", async () => {
    const { rerender } = render(<App />);
    // 글꼴 준비 전에 로그인 마무리가 끝난다
    await waitFor(() => expect(auth.completeSignIn).toHaveBeenCalled());
    await act(async () => {});
    fonts.ready = true;
    rerender(<App />);
    await waitFor(() =>
      expect(storage.store).toHaveBeenCalledWith("session", {
        source: "api",
        user,
      }),
    );
    expect(
      await screen.findByText("부산사람님, 다시 만나 반가워요"),
    ).toBeTruthy();
  });

  it("콜백 주소에서는 저장된 옛 세션을 복원하지 않는다", async () => {
    storage.values.session = { source: "api", user: { ...user, id: "old" } };
    // 인가 코드 교환은 네트워크라 저장소 읽기보다 늦게 끝난다
    auth.completeSignIn.mockImplementation(
      () =>
        new Promise((r) =>
          setTimeout(() => r({ kind: "session", session }), 50),
        ),
    );
    fonts.ready = true;
    render(<App />);
    await waitFor(() =>
      expect(storage.store).toHaveBeenCalledWith("session", {
        source: "api",
        user,
      }),
    );
    expect(auth.restore).not.toHaveBeenCalled();
  });

  it("콜백 주소가 아니면 저장된 세션을 복원한다", async () => {
    window.history.replaceState(null, "", "/");
    storage.values.session = { source: "api", user };
    auth.completeSignIn.mockResolvedValue(null);
    auth.restore.mockReset().mockResolvedValue(session);
    fonts.ready = true;
    render(<App />);
    await waitFor(() => expect(auth.restore).toHaveBeenCalled());
  });
});
