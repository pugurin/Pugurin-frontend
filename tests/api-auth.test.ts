import { describe, expect, it, vi } from "vitest";
import { ApiAuth } from "../src/api/apiAuth";
import { ApiError } from "../src/api/client";
import type { WebCallback } from "../src/auth/webOAuth";

const apiUser = {
  id: "u1",
  nickname: "부산사람",
  role: "buyer",
  provider: "kakao",
  verified_ownership_count: 0,
  active_listing_count: 0,
  consents: {
    marketing_push: true,
    marketing_consented_at: "2026-11-13T10:00:00+09:00",
  },
  settings: { loading_tips: true, unseen_term_dots: true },
  created_at: "2026-11-13T10:00:00+09:00",
};
const user = {
  id: "u1",
  nickname: "부산사람",
  role: "buyer",
  provider: "kakao",
  marketing_push: true,
  created_at: "2026-11-13T10:00:00+09:00",
};
type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  credentials?: string;
};
const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

// 경로별 응답을 정하는 가짜 서버
function server(
  routes: Record<string, (call: Call) => Response | Promise<Response>>,
) {
  const calls: Call[] = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      url: url.replace("http://api/api/v1", ""),
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      credentials: init.credentials,
    };
    calls.push(call);
    const route = routes[`${call.method} ${call.url}`];
    if (!route) throw new Error(`모르는 요청 ${call.method} ${call.url}`);
    return route(call);
  });
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}
function make(
  routes: Parameters<typeof server>[0],
  callback: WebCallback | null = null,
  start = vi.fn(async () => {}),
) {
  const { fetcher, calls } = server(routes);
  const auth = new ApiAuth({
    base: "http://api/api/v1",
    deviceId: () => "device-1",
    oauth: { start, finish: () => callback },
    fetcher,
  });
  return { auth, calls, start };
}
const kakaoCode: WebCallback = {
  provider: "kakao",
  code: "c",
  state: "s",
  redirect_uri: "https://pugurin.netlify.app/auth/callback",
};
const signedIn = () =>
  json(200, {
    data: { is_new_user: false, access_token: "a1", user: apiUser },
    meta: {},
  });

describe("실제 인증 서버(웹)", () => {
  it("로그인은 소셜 로그인으로 이동만 하고, 돌아온 뒤 끝낸다", async () => {
    const { auth, start, calls } = make({});
    void auth.signIn("kakao");
    await Promise.resolve();
    expect(start).toHaveBeenCalledWith("kakao");
    expect(calls).toEqual([]);
  });

  it("돌아온 인가 코드를 서버에 넘기고, 가입한 사람이면 세션을 만든다", async () => {
    const { auth, calls } = make(
      { "POST /auth/oauth/kakao": signedIn },
      kakaoCode,
    );
    const r = await auth.completeSignIn();
    expect(r).toEqual({
      kind: "session",
      session: { source: "api", user, access_token: "a1", refresh_token: "" },
    });
    expect(calls[0].headers).toMatchObject({
      "X-Client": "web",
      "X-Device-Id": "device-1",
    });
    expect(calls[0].credentials).toBe("include");
    expect(calls[0].body).toEqual({
      code: "c",
      state: "s",
      redirect_uri: kakaoCode.redirect_uri,
    });
  });

  it("처음 온 사람이면 가입 토큰과 프로필 닉네임을 준다", async () => {
    const { auth } = make(
      {
        "POST /auth/oauth/google": () =>
          json(200, {
            data: {
              is_new_user: true,
              signup_token: "su",
              profile: { nickname: null },
            },
            meta: {},
          }),
      },
      { ...kakaoCode, provider: "google", code_verifier: "v".repeat(43) },
    );
    expect(await auth.completeSignIn()).toEqual({
      kind: "signup",
      signup_token: "su",
      provider: "google",
      nickname: null,
    });
  });

  it("구글은 code_verifier를 같이 보낸다", async () => {
    const { auth, calls } = make(
      { "POST /auth/oauth/google": signedIn },
      { ...kakaoCode, provider: "google", code_verifier: "v".repeat(43) },
    );
    await auth.completeSignIn();
    expect(calls[0].body.code_verifier).toBe("v".repeat(43));
  });

  it("돌아온 코드가 없으면 아무것도 하지 않는다", async () => {
    const { auth, calls } = make({});
    expect(await auth.completeSignIn()).toBeNull();
    expect(calls).toEqual([]);
  });

  it("서버 오류는 서버 문구와 코드로 알린다", async () => {
    const { auth } = make(
      {
        "POST /auth/oauth/kakao": () =>
          json(503, {
            error: {
              code: "SOURCE_UNAVAILABLE",
              message: "카카오 로그인을 쓸 수 없습니다",
            },
          }),
      },
      kakaoCode,
    );
    await expect(auth.completeSignIn()).rejects.toMatchObject({
      code: "SOURCE_UNAVAILABLE",
      message: "카카오 로그인을 쓸 수 없습니다",
    });
  });

  it("가입을 마치면 세션을 준다", async () => {
    const { auth, calls } = make({ "POST /auth/signup": signedIn });
    const agreements = {
      terms: true,
      privacy: true,
      age14: true,
      marketing: true,
    };
    const session = await auth.signUp("su", " 부산사람 ", agreements);
    expect(session.user).toEqual(user);
    expect(calls[0].body).toEqual({
      signup_token: "su",
      nickname: "부산사람",
      agreements,
    });
  });

  it("저장한 세션은 쿠키로 갱신하고 내 정보를 받아 되살린다", async () => {
    const { auth, calls } = make({
      "POST /auth/refresh": () =>
        json(200, { data: { access_token: "a2" }, meta: {} }),
      "GET /users/me": () => json(200, { data: apiUser, meta: {} }),
    });
    const session = await auth.restore({ source: "api", user });
    expect(session).toEqual({
      source: "api",
      user,
      access_token: "a2",
      refresh_token: "",
    });
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "/auth/refresh",
      credentials: "include",
    });
    expect(calls[0].headers["X-Client"]).toBe("web");
    expect(calls[1].headers.Authorization).toBe("Bearer a2");
  });

  it("갱신은 한 번에 하나만 보낸다", async () => {
    let finish: (r: Response) => void = () => {};
    const { auth, calls } = make({
      "POST /auth/refresh": () => new Promise<Response>((r) => (finish = r)),
      "GET /users/me": () => json(200, { data: apiUser, meta: {} }),
    });
    const first = auth.restore({ source: "api", user });
    const second = auth.restore({ source: "api", user });
    await Promise.resolve();
    finish(json(200, { data: { access_token: "a2" }, meta: {} }));
    await Promise.all([first, second]);
    expect(calls.filter((c) => c.url === "/auth/refresh")).toHaveLength(1);
  });

  it("다른 요청(관심 목록)이 쓸 access token을 알려 주고, 갱신하면 새 토큰으로 바꾼다", async () => {
    const { auth } = make({
      "POST /auth/oauth/kakao": signedIn,
      "POST /auth/refresh": () =>
        json(200, { data: { access_token: "a2" }, meta: {} }),
    });
    expect(auth.accessToken()).toBeUndefined();
    const make2 = make({ "POST /auth/oauth/kakao": signedIn }, kakaoCode);
    await make2.auth.completeSignIn();
    expect(make2.auth.accessToken()).toBe("a1");
    expect(await auth.refreshAccess()).toBe("a2");
    expect(auth.accessToken()).toBe("a2");
    await auth.signOut().catch(() => {});
    expect(auth.accessToken()).toBeUndefined();
  });

  it("갱신이 401이면 다시 로그인하라고 알린다", async () => {
    const { auth } = make({
      "POST /auth/refresh": () =>
        json(401, {
          error: { code: "UNAUTHORIZED", message: "다시 로그인해 주세요" },
        }),
    });
    await expect(auth.restore({ source: "api", user })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("샘플 세션은 서버에 묻지 않고 버린다", async () => {
    const { auth, calls } = make({});
    await expect(
      auth.restore({ source: "sample", user }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(calls).toEqual([]);
  });

  it("닉네임을 바꾸다 access token이 만료되면 한 번 갱신하고 다시 보낸다", async () => {
    let first = true;
    const { auth, calls } = make({
      "PATCH /users/me": (c) => {
        if (first) {
          first = false;
          return json(401, {
            error: { code: "UNAUTHORIZED", message: "만료" },
          });
        }
        return json(200, {
          data: { ...apiUser, nickname: c.body.nickname },
          meta: {},
        });
      },
      "POST /auth/refresh": () =>
        json(200, { data: { access_token: "a3" }, meta: {} }),
    });
    const session = {
      source: "api" as const,
      user: user as never,
      access_token: "old",
      refresh_token: "",
    };
    const next = await auth.updateNickname(session, "해운대");
    expect(next.nickname).toBe("해운대");
    expect(
      calls.map((c) =>
        `${c.method} ${c.url} ${c.headers.Authorization ?? ""}`.trim(),
      ),
    ).toEqual([
      "PATCH /users/me Bearer old",
      "POST /auth/refresh",
      "PATCH /users/me Bearer a3",
    ]);
  });

  it("로그아웃은 쿠키의 refresh token을 폐기하고, 탈퇴는 내 계정을 지운다", async () => {
    const { auth, calls } = make({
      "POST /auth/logout": () => json(204, null),
      "DELETE /users/me": () => json(204, null),
    });
    const session = {
      source: "api" as const,
      user: user as never,
      access_token: "a1",
      refresh_token: "",
    };
    await auth.signOut(session);
    await auth.withdraw(session);
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "/auth/logout",
      credentials: "include",
    });
    expect(calls[1].headers.Authorization).toBe("Bearer a1");
  });

  it("서버에 닿지 못하면 네트워크 오류로 알린다", async () => {
    const auth = new ApiAuth({
      base: "http://api/api/v1",
      deviceId: () => "d",
      oauth: { start: async () => {}, finish: () => null },
      fetcher: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    await expect(
      auth.restore({ source: "api", user: user as never }),
    ).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});
