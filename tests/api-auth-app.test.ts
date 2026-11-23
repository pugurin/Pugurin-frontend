import { describe, expect, it, vi } from "vitest";
import { ApiAuth, type SocialLogin } from "../src/api/apiAuth";

// 앱(X-Client: app) 로그인: 카카오 SDK 토큰을 보내고 refresh token을 본문으로 주고받는다
const USER = {
  id: "u1",
  nickname: "부산사람",
  role: "buyer",
  provider: "kakao",
  consents: { marketing_push: true },
  created_at: "2026-11-17T10:00:00+09:00",
};
type Call = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any;
};

function make(routes: Record<string, Array<[number, unknown?]>>) {
  const calls: Call[] = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    const path = url.replace("https://api.test/api/v1", "");
    const method = init.method ?? "GET";
    calls.push({
      method,
      path,
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    const [status, data] = routes[`${method} ${path}`]?.shift() ?? [
      404,
      undefined,
    ];
    return new Response(
      status === 204
        ? null
        : JSON.stringify(status < 400 ? { data, meta: {} } : data),
      { status },
    );
  });
  const social: SocialLogin = { start: vi.fn(async () => "kakao-sdk-token") };
  const onTokens = vi.fn();
  const auth = new ApiAuth({
    base: "https://api.test/api/v1",
    deviceId: async () => "device-1",
    client: "app",
    social,
    onTokens,
    fetcher: fetcher as unknown as typeof fetch,
  });
  return { auth, calls, onTokens, social };
}
const session = {
  source: "api" as const,
  user: { ...USER, marketing_push: true } as any,
  access_token: "a1",
  refresh_token: "r1",
};
const saved = { source: "api" as const, user: session.user };

describe("앱 카카오 로그인", () => {
  it("SDK 토큰을 보내고, 처음이면 가입 토큰 → 가입하면 refresh token을 받는다", async () => {
    const { auth, calls } = make({
      "POST /auth/oauth/kakao": [
        [
          200,
          {
            is_new_user: true,
            signup_token: "st",
            profile: { nickname: "카카오이름" },
          },
        ],
      ],
      "POST /auth/signup": [
        [
          200,
          {
            is_new_user: false,
            access_token: "a1",
            refresh_token: "r1",
            user: USER,
          },
        ],
      ],
    });
    expect(await auth.signIn("kakao")).toEqual({
      kind: "signup",
      signup_token: "st",
      provider: "kakao",
      nickname: "카카오이름",
    });
    expect(calls[0].body).toEqual({ access_token: "kakao-sdk-token" });
    expect(calls[0].headers).toMatchObject({
      "X-Client": "app",
      "X-Device-Id": "device-1",
    });
    const s = await auth.signUp("st", "부산사람", {
      terms: true,
      privacy: true,
      age14: true,
      marketing: false,
    });
    expect(s).toMatchObject({
      access_token: "a1",
      refresh_token: "r1",
      user: { marketing_push: true },
    });
  });

  it("SDK가 실패하면 서버를 부르지 않는다", async () => {
    const { auth, calls, social } = make({});
    (social.start as any).mockRejectedValueOnce(
      new Error("로그인을 취소했어요"),
    );
    await expect(auth.signIn("kakao")).rejects.toThrow("취소");
    expect(calls).toHaveLength(0);
  });
});

describe("앱 토큰 갱신", () => {
  it("401이면 refresh token을 본문으로 보내 갱신하고, 새 값을 onTokens로 알린다", async () => {
    const { auth, calls, onTokens } = make({
      "PATCH /users/me": [
        [401, { error: { code: "UNAUTHORIZED" } }],
        [200, { ...USER, nickname: "해운대주민" }],
      ],
      "POST /auth/refresh": [
        [200, { access_token: "a2", refresh_token: "r2" }],
      ],
    });
    expect((await auth.updateNickname(session, "해운대주민")).nickname).toBe(
      "해운대주민",
    );
    expect(calls[1]).toMatchObject({
      path: "/auth/refresh",
      body: { refresh_token: "r1" },
    });
    expect(calls[2].headers.Authorization).toBe("Bearer a2");
    expect(onTokens).toHaveBeenCalledWith(
      { access_token: "a2", refresh_token: "r2" },
      "r1",
    );
  });

  it("복원 재시도에 옛 refresh token이 와도 이미 바뀐 새 값으로 보낸다", async () => {
    const { auth, calls } = make({
      "POST /auth/refresh": [
        [200, { access_token: "a2", refresh_token: "r2" }],
        [200, { access_token: "a3", refresh_token: "r3" }],
      ],
      "GET /users/me": [
        [503, {}],
        [200, USER],
      ],
    });
    await expect(auth.restore(saved, "r1")).rejects.toBeTruthy();
    const s = await auth.restore(saved, "r1");
    expect(
      calls.filter((c) => c.path === "/auth/refresh").map((c) => c.body),
    ).toEqual([{ refresh_token: "r1" }, { refresh_token: "r2" }]);
    expect(s).toMatchObject({ access_token: "a3", refresh_token: "r3" });
  });

  it("refresh token이 없으면 서버에 묻지 않고 다시 로그인하게 한다", async () => {
    const { auth, calls } = make({});
    await expect(auth.restore(saved)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(calls).toHaveLength(0);
  });

  it("로그아웃은 그 refresh token을 본문으로 보낸다", async () => {
    const { auth, calls } = make({ "POST /auth/logout": [[204]] });
    await auth.signOut(session);
    expect(calls[0]).toMatchObject({
      headers: { "X-Client": "app" },
      body: { refresh_token: "r1" },
    });
  });

  it("갱신 중에 로그아웃하면 갱신이 끝난 뒤 회전된 새 refresh token으로 로그아웃한다", async () => {
    const { auth, calls } = make({
      "POST /auth/refresh": [
        [200, { access_token: "a2", refresh_token: "r2" }],
      ],
      "GET /users/me": [[200, USER]],
      "POST /auth/logout": [[204]],
    });
    const restoring = auth.restore(saved, "r1");
    await auth.signOut(session);
    await restoring.catch(() => {});
    expect(calls.find((c) => c.path === "/auth/logout")?.body).toEqual({
      refresh_token: "r2",
    });
  });

  it("관심 목록이 401을 받아 갱신하면 가장 최근 refresh token으로 회전하고 onTokens로 저장한다", async () => {
    const { auth, calls, onTokens } = make({
      "POST /auth/oauth/kakao": [
        [
          200,
          {
            is_new_user: false,
            access_token: "a1",
            refresh_token: "r1",
            user: USER,
          },
        ],
      ],
      "POST /auth/refresh": [
        [200, { access_token: "a2", refresh_token: "r2" }],
        [200, { access_token: "a3", refresh_token: "r3" }],
      ],
    });
    await auth.signIn("kakao");
    expect(auth.accessToken()).toBe("a1");
    expect(await auth.refreshAccess("a1")).toBe("a2");
    expect(await auth.refreshAccess("a2")).toBe("a3");
    expect(
      calls.filter((c) => c.path === "/auth/refresh").map((c) => c.body),
    ).toEqual([{ refresh_token: "r1" }, { refresh_token: "r2" }]);
    expect(onTokens).toHaveBeenNthCalledWith(
      1,
      { access_token: "a2", refresh_token: "r2" },
      "r1",
    );
    expect(onTokens).toHaveBeenNthCalledWith(
      2,
      { access_token: "a3", refresh_token: "r3" },
      "r2",
    );
  });

  it("앱은 갱신이 401이면 같은 refresh token을 다시 보내지 않고(모든 기기 로그아웃 방지) 토큰을 비운다", async () => {
    const { auth, calls } = make({
      "POST /auth/oauth/kakao": [
        [
          200,
          {
            is_new_user: false,
            access_token: "a1",
            refresh_token: "r1",
            user: USER,
          },
        ],
      ],
      "POST /auth/refresh": [[401, { error: { code: "UNAUTHORIZED" } }]],
    });
    await auth.signIn("kakao");
    await expect(auth.refreshAccess("a1")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(calls.filter((c) => c.path === "/auth/refresh")).toHaveLength(1);
    expect(auth.accessToken()).toBeUndefined();
    // 버린 refresh token으로 다시 갱신하지 않는다
    await expect(auth.refreshAccess("a1")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(calls.filter((c) => c.path === "/auth/refresh")).toHaveLength(1);
  });

  it("두 요청이 동시에 401을 받아도 refresh는 한 번만 보낸다", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls: string[] = [];
    let patches = 0;
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace("https://api.test/api/v1", "");
      calls.push(`${init.method} ${path}`);
      const auth = (init.headers as Record<string, string>).Authorization;
      if (path === "/auth/refresh") {
        await gate;
        return new Response(
          JSON.stringify({ data: { access_token: "a2", refresh_token: "r2" } }),
          { status: 200 },
        );
      }
      if (auth === "Bearer a1") {
        if (++patches === 2) release();
        return new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED" } }),
          { status: 401 },
        );
      }
      return new Response(JSON.stringify({ data: USER }), { status: 200 });
    });
    const auth = new ApiAuth({
      base: "https://api.test/api/v1",
      deviceId: async () => "device-1",
      client: "app",
      fetcher: fetcher as unknown as typeof fetch,
    });
    await Promise.all([
      auth.updateNickname(session, "가"),
      auth.updateNickname(session, "나"),
    ]);
    expect(calls.filter((c) => c === "POST /auth/refresh")).toHaveLength(1);
    expect(calls.filter((c) => c === "PATCH /users/me")).toHaveLength(4);
  });
});
