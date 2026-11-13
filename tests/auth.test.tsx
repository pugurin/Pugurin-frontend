import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SampleAuth, nicknameError, toStored, type Session } from "../src/api/auth";
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
beforeEach(() => storage.data.clear());
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
    const saved = toStored(session, false);
    expect(await auth.restore(saved)).toMatchObject({ source: "sample", user: { nickname: "부산사람" } });
    await expect(auth.restore({ ...saved, source: "api" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await auth.withdraw(session);
    await expect(auth.restore(saved)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("기기에는 access token을 남기지 않고, 웹은 refresh token도 남기지 않는다", () => {
    const session: Session = {
      source: "sample",
      user: { id: "u", nickname: "부산사람", provider: "kakao", role: "buyer", marketing_push: false, created_at: "2026-11-13T00:00:00Z" },
      access_token: "a",
      refresh_token: "r",
    };
    expect(toStored(session, true)).toEqual({ source: "sample", user: session.user });
    expect(toStored(session, false)).toEqual({ source: "sample", user: session.user, refresh_token: "r" });
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
