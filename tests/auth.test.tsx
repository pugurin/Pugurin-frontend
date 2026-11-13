import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Platform } from "react-native";
import { SampleAuth, nicknameError, toStored, type AuthApi, type Session } from "../src/api/auth";
import { ApiError } from "../src/api/client";
import { restoreSession } from "../src/api/restoreSession";
import { loadRefreshToken, saveRefreshToken } from "../src/state/secureToken";
import { AccountScreen, LoginScreen, SignupScreen } from "../src/screens/AuthScreens";
import { MoreScreen } from "../src/screens/MoreScreen";

const storage = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn(async (k: string) => data.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)),
  };
});
vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));
const secure = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: vi.fn(async (k: string) => data.get(k) ?? null),
    setItemAsync: vi.fn(async (k: string, v: string) => void data.set(k, v)),
    deleteItemAsync: vi.fn(async (k: string) => void data.delete(k)),
  };
});
vi.mock("expo-secure-store", () => secure);
beforeEach(() => {
  storage.data.clear();
  secure.data.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);
const flush = () => act(() => new Promise((r) => setTimeout(r, 5)));
const all = { terms: true, privacy: true, age14: true, marketing: false };

describe("닉네임 규칙", () => {
  it("2~12자 한글·영문·숫자만 받는다", () => {
    expect(nicknameError("연산우린")).toBeNull();
    expect(nicknameError("a")).toContain("2~12자");
    expect(nicknameError("가".repeat(13))).toContain("2~12자");
    expect(nicknameError("연산 우린")).toContain("띄어쓰기");
    expect(nicknameError("우린!")).toContain("기호");
  });
});

describe("샘플 인증 서버", () => {
  it("처음이면 가입 토큰, 가입한 뒤에는 바로 세션을 준다", async () => {
    const auth = new SampleAuth(0);
    const first = await auth.signIn("google");
    expect(first).toMatchObject({ kind: "signup", provider: "google", nickname: "구글이웃" });
    if (first.kind !== "signup") throw new Error();
    const session = await auth.signUp(first.signup_token, "부산사람", { ...all, marketing: true });
    expect(session.user).toMatchObject({ nickname: "부산사람", provider: "google", role: "buyer", marketing_push: true });
    expect(await auth.signIn("google")).toMatchObject({ kind: "session", session: { user: { nickname: "부산사람" } } });
    // 다른 소셜 계정은 따로 가입한다
    expect((await auth.signIn("naver")).kind).toBe("signup");
  });

  it("필수 동의가 빠지거나 닉네임이 규칙에 어긋나면 가입하지 않는다", async () => {
    const auth = new SampleAuth(0);
    const r = await auth.signIn("kakao");
    if (r.kind !== "signup") throw new Error();
    await expect(auth.signUp(r.signup_token, "부산사람", { ...all, age14: false })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(auth.signUp(r.signup_token, "부산 사람", all)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("닉네임을 바꾸면 다음 로그인에도 남고, 탈퇴하면 다시 가입부터 한다", async () => {
    const auth = new SampleAuth(0);
    const r = await auth.signIn("kakao");
    if (r.kind !== "signup") throw new Error();
    const session = await auth.signUp(r.signup_token, "부산사람", all);
    await auth.updateNickname(session, "해운대주민");
    expect(await auth.signIn("kakao")).toMatchObject({ session: { user: { nickname: "해운대주민" } } });
    await auth.withdraw(session);
    expect((await auth.signIn("kakao")).kind).toBe("signup");
  });

  it("저장한 세션은 계정이 있을 때만 새 토큰으로 되살리고, 출처가 다르거나 탈퇴했으면 거절한다", async () => {
    const auth = new SampleAuth(0);
    const r = await auth.signIn("kakao");
    if (r.kind !== "signup") throw new Error();
    const session = await auth.signUp(r.signup_token, "부산사람", all);
    expect(session.source).toBe("sample");
    const saved = toStored(session);
    expect(await auth.restore(saved)).toMatchObject({ source: "sample", user: { nickname: "부산사람" } });
    await expect(auth.restore({ ...saved, source: "api" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await auth.withdraw(session);
    await expect(auth.restore(saved)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("일반 저장소에는 토큰을 남기지 않는다", () => {
    const session: Session = {
      source: "sample",
      user: { id: "u", nickname: "부산사람", provider: "kakao", role: "buyer", marketing_push: false, created_at: "2026-11-13T00:00:00Z" },
      access_token: "a",
      refresh_token: "r",
    };
    expect(toStored(session)).toEqual({ source: "sample", user: session.user });
  });
});

describe("refresh token 보안 저장소", () => {
  afterEach(() => {
    (Platform as { OS: string }).OS = "web";
  });
  it("앱은 SecureStore에만 저장하고 지운다", async () => {
    (Platform as { OS: string }).OS = "ios";
    await saveRefreshToken("r1");
    expect(secure.setItemAsync).toHaveBeenCalledWith("pugurin.refresh_token", "r1");
    expect(await loadRefreshToken()).toBe("r1");
    await saveRefreshToken(null);
    expect(await loadRefreshToken()).toBeUndefined();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("웹은 아무것도 저장하지 않는다(쿠키로 받는다)", async () => {
    await saveRefreshToken("r1");
    expect(secure.setItemAsync).not.toHaveBeenCalled();
    expect(await loadRefreshToken()).toBeUndefined();
  });
});

describe("세션 복원", () => {
  const user = { id: "u", nickname: "부산사람", provider: "kakao" as const, role: "buyer" as const, marketing_push: false, created_at: "2026-11-13T00:00:00Z" };
  const saved = { source: "sample" as const, user };
  const fresh: Session = { ...saved, access_token: "a", refresh_token: "r" };
  // restore 결과를 바깥에서 정하는 가짜 인증 서버
  const pending = () => {
    const calls: { resolve: (s: Session) => void; reject: (e: unknown) => void }[] = [];
    const auth = {
      source: "sample",
      restore: vi.fn(() => new Promise<Session>((resolve, reject) => calls.push({ resolve, reject }))),
    } as unknown as AuthApi;
    return { auth, calls };
  };
  const handlers = () => ({ onSession: vi.fn(), onClear: vi.fn(), onGiveUp: vi.fn() });

  it("복원 중에 사용자가 로그인·로그아웃했으면 늦게 온 결과를 버린다", async () => {
    const { auth, calls } = pending();
    const h = handlers();
    let current = true;
    restoreSession({ auth, saved, isCurrent: () => current, ...h });
    current = false;
    calls[0].resolve(fresh);
    await flush();
    expect(h.onSession).not.toHaveBeenCalled();
    // 실패해도 새 세션을 지우지 않는다
    const second = pending();
    restoreSession({ auth: second.auth, saved, isCurrent: () => current, ...h });
    second.calls[0].reject(new ApiError("만료", "UNAUTHORIZED"));
    await flush();
    expect(h.onClear).not.toHaveBeenCalled();
  });

  it("401이면 지우고, 네트워크 오류면 다시 확인한 뒤 안내한다", async () => {
    const { auth, calls } = pending();
    const h = handlers();
    restoreSession({ auth, saved, isCurrent: () => true, retries: 1, retryMs: 0, ...h });
    calls[0].reject(new ApiError("연결 실패", "NETWORK_ERROR"));
    await flush();
    expect(h.onClear).not.toHaveBeenCalled();
    expect(calls).toHaveLength(2);
    calls[1].reject(new ApiError("연결 실패", "NETWORK_ERROR"));
    await flush();
    expect(h.onGiveUp).toHaveBeenCalledTimes(1);

    const other = pending();
    const h2 = handlers();
    restoreSession({ auth: other.auth, saved, isCurrent: () => true, ...h2 });
    other.calls[0].reject(new ApiError("만료", "UNAUTHORIZED"));
    await flush();
    expect(h2.onClear).toHaveBeenCalled();
    expect(h2.onGiveUp).not.toHaveBeenCalled();
  });

  it("확인되면 새 세션으로 바꾸고, 앱의 refresh token을 넘긴다", async () => {
    const { auth, calls } = pending();
    const h = handlers();
    restoreSession({ auth, saved, refreshToken: "r0", isCurrent: () => true, ...h });
    expect(auth.restore).toHaveBeenCalledWith(saved, "r0");
    calls[0].resolve(fresh);
    await flush();
    expect(h.onSession).toHaveBeenCalledWith(fresh);
  });
});

describe("로그인·가입 화면", () => {
  it("네이버·카카오·구글 순서로 버튼을 두고, 처음이면 가입으로 넘긴다", async () => {
    const onSignup = vi.fn();
    const onSession = vi.fn();
    render(<LoginScreen auth={new SampleAuth(0)} onBack={() => {}} onSession={onSession} onSignup={onSignup} />);
    const buttons = screen.getAllByRole("button", { name: /로 시작하기$/ }).map((b) => b.getAttribute("aria-label"));
    expect(buttons).toEqual(["네이버로 시작하기", "카카오로 시작하기", "구글로 시작하기"]);
    // 버튼마다 그 서비스 로고를 그린다
    expect(screen.getAllByRole("img", { name: /^(네이버|카카오|구글) 로고$/ }).map((i) => i.getAttribute("aria-label"))).toEqual([
      "네이버 로고",
      "카카오 로고",
      "구글 로고",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "구글로 시작하기" }));
    await flush();
    expect(onSignup).toHaveBeenCalledWith(expect.objectContaining({ kind: "signup", provider: "google" }));
    expect(onSession).not.toHaveBeenCalled();
  });

  it("가입 버튼은 필수 동의를 모두 켜고 닉네임이 맞아야 눌린다", async () => {
    const auth = new SampleAuth(0);
    const signup = await auth.signIn("naver");
    if (signup.kind !== "signup") throw new Error();
    const onSession = vi.fn();
    render(<SignupScreen auth={auth} signup={signup} onBack={() => {}} onSession={onSession} />);
    const submit = () => screen.getByRole("button", { name: "가입하고 시작하기" });
    expect(submit().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("checkbox", { name: "[필수] 만 14세 이상이에요" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "[필수] 서비스 이용약관 동의" }));
    expect(submit().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("checkbox", { name: "[필수] 개인정보 수집·이용 동의" }));
    expect(submit().getAttribute("aria-disabled")).not.toBe("true");
    // 선택 항목은 꺼 둬도 된다. 닉네임이 어긋나면 다시 막힌다
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "부산 사람" } });
    expect(submit().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("한글·영문·숫자만 쓸 수 있어요(띄어쓰기·기호 없이)")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "부산사람" } });
    fireEvent.click(submit());
    await flush();
    expect(onSession).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ nickname: "부산사람", provider: "naver", marketing_push: false }) }));
  });

  it("모두 동의하면 선택 항목까지 켜지고, 다시 누르면 모두 꺼진다", async () => {
    const auth = new SampleAuth(0);
    const signup = await auth.signIn("kakao");
    if (signup.kind !== "signup") throw new Error();
    render(<SignupScreen auth={auth} signup={signup} onBack={() => {}} onSession={() => {}} />);
    const boxes = () => screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-checked"));
    fireEvent.click(screen.getByRole("checkbox", { name: "모두 동의해요" }));
    expect(boxes()).toEqual(Array(5).fill("true"));
    fireEvent.click(screen.getByRole("checkbox", { name: "모두 동의해요" }));
    expect(boxes()).toEqual(Array(5).fill("false"));
  });

  it("회원 탈퇴는 안내를 확인해야 누를 수 있다", async () => {
    const auth = new SampleAuth(0);
    const signup = await auth.signIn("kakao");
    if (signup.kind !== "signup") throw new Error();
    const session: Session = await auth.signUp(signup.signup_token, "부산사람", all);
    const onSignedOut = vi.fn();
    render(<AccountScreen auth={auth} session={session} onBack={() => {}} onUser={() => {}} onSignedOut={onSignedOut} notify={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
    const leave = () => screen.getByRole("button", { name: "탈퇴하기" });
    expect(leave().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("checkbox", { name: "안내를 확인했어요" }));
    fireEvent.click(leave());
    await flush();
    expect(onSignedOut).toHaveBeenCalledWith(true);
    expect((await auth.signIn("kakao")).kind).toBe("signup");
  });
});

describe("인증 화면 세부", () => {
  it("로그인 실패는 화면 낭독기에 알림(alert)으로 알린다", async () => {
    const auth = new SampleAuth(0);
    auth.signIn = () => Promise.reject(new ApiError("로그인하지 못했어요", "NETWORK_ERROR"));
    render(<LoginScreen auth={auth} onBack={() => {}} onSession={() => {}} onSignup={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBeTruthy();
  });

  it("가입일은 한국 시간 날짜로 보여 준다", () => {
    const session: Session = {
      source: "sample",
      // 한국 시간 2026-11-13 01:00
      user: { id: "u", nickname: "부산사람", provider: "kakao", role: "buyer", marketing_push: false, created_at: "2026-11-12T16:00:00Z" },
      access_token: "a",
      refresh_token: "r",
    };
    render(<AccountScreen auth={new SampleAuth(0)} session={session} onBack={() => {}} onUser={() => {}} onSignedOut={() => {}} notify={() => {}} />);
    expect(screen.getByText(/2026\.11\.13 가입/)).toBeTruthy();
  });

  it("샘플 로그인 안내는 샘플 인증일 때만 보여 준다", () => {
    const notice = /샘플 로그인이에요/;
    const { unmount } = render(<LoginScreen auth={new SampleAuth(0)} onBack={() => {}} onSession={() => {}} onSignup={() => {}} />);
    expect(screen.getByText(notice)).toBeTruthy();
    unmount();
    const real = { ...new SampleAuth(0), source: "api" } as unknown as AuthApi;
    render(<LoginScreen auth={real} onBack={() => {}} onSession={() => {}} onSignup={() => {}} />);
    expect(screen.queryByText(notice)).toBeNull();
  });
});

describe("더보기 계정 카드", () => {
  const base = {
    mode: "api" as const,
    onMode: () => {},
    onDate: () => {},
    onTerms: () => {},
    notify: () => {},
    todayEnabled: true,
    onTodayEnabled: () => {},
  };
  it("로그인 전에는 로그인 카드, 뒤에는 닉네임 카드를 보여 준다", () => {
    const onLogin = vi.fn();
    const { rerender } = render(<MoreScreen {...base} user={null} onLogin={onLogin} />);
    fireEvent.click(screen.getByRole("button", { name: "로그인 · 회원가입" }));
    expect(onLogin).toHaveBeenCalled();
    expect(screen.getByText("네이버·카카오·구글 계정으로 바로 시작해요")).toBeTruthy();
    const onAccount = vi.fn();
    rerender(
      <MoreScreen
        {...base}
        user={{ id: "u", nickname: "부산사람", provider: "google", role: "buyer", marketing_push: false, created_at: "2026-11-13T00:00:00Z" }}
        onAccount={onAccount}
      />,
    );
    expect(screen.getByText("구글 계정으로 로그인했어요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "부산사람 내 정보" }));
    expect(onAccount).toHaveBeenCalled();
  });

  it("로그인을 열지 않은 빌드에서는 준비 중 카드만 보여 준다", () => {
    render(<MoreScreen {...base} user={null} />);
    expect(screen.getByText("로그인과 관심 기능은 다음 단계에서 준비하고 있어요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "로그인 · 회원가입" })).toBeNull();
  });
});
