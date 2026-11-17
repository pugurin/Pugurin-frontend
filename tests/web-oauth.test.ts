import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import {
  RedirectOAuth,
  authorizeUrl,
  pkceChallenge,
  type OAuthConfig,
} from "../src/auth/webOAuth";

const config: OAuthConfig = {
  redirectUri: "https://pugurin.vercel.app/auth/callback",
  clientIds: { kakao: "kakao-rest", naver: "naver-id", google: "google-id" },
};

// 브라우저 대역: 주소창·기록·세션 저장소
function browser(href = "https://pugurin.vercel.app/") {
  const store = new Map<string, string>();
  const env = {
    location: { href, assign: (url: string) => (env.location.href = url) },
    history: {
      replaceState: (_: unknown, __: string, url: string) =>
        (env.location.href = new URL(url, env.location.href).href),
    },
    storage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  return { env, store };
}

describe("소셜 로그인 주소", () => {
  it("카카오·네이버는 인가 코드 주소에 client_id·redirect_uri·state를 담는다", () => {
    const kakao = new URL(authorizeUrl("kakao", config, "st"));
    expect(kakao.origin + kakao.pathname).toBe(
      "https://kauth.kakao.com/oauth/authorize",
    );
    expect(Object.fromEntries(kakao.searchParams)).toEqual({
      response_type: "code",
      client_id: "kakao-rest",
      redirect_uri: config.redirectUri,
      state: "st",
    });
    const naver = new URL(authorizeUrl("naver", config, "st"));
    expect(naver.origin + naver.pathname).toBe(
      "https://nid.naver.com/oauth2.0/authorize",
    );
    expect(naver.searchParams.get("client_id")).toBe("naver-id");
  });

  it("구글은 openid profile 범위와 PKCE(S256)를 쓴다", () => {
    const google = new URL(authorizeUrl("google", config, "st", "challenge"));
    expect(google.origin + google.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(google.searchParams.get("scope")).toBe("openid profile");
    expect(google.searchParams.get("code_challenge")).toBe("challenge");
    expect(google.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("PKCE challenge는 verifier의 SHA-256을 base64url로 바꾼 값이다", async () => {
    // RFC 7636 부록 B의 예시
    expect(
      await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("리다이렉트 로그인", () => {
  it("시작하면 state·verifier를 세션 저장소에 두고 소셜 로그인으로 이동한다", async () => {
    const { env, store } = browser();
    await new RedirectOAuth(config, env).start("google");
    const url = new URL(env.location.href);
    expect(url.host).toBe("accounts.google.com");
    const pending = JSON.parse(store.get("pugurin.oauth")!);
    expect(pending.provider).toBe("google");
    expect(url.searchParams.get("state")).toBe(pending.state);
    expect(pending.verifier.length).toBeGreaterThanOrEqual(43);
    expect(url.searchParams.get("code_challenge")).toBe(
      await pkceChallenge(pending.verifier),
    );
  });

  it("콜백 주소로 돌아오면 코드를 꺼내고, 주소와 저장소를 정리한다", async () => {
    const { env, store } = browser();
    const oauth = new RedirectOAuth(config, env);
    await oauth.start("google");
    const { state, verifier } = JSON.parse(store.get("pugurin.oauth")!);
    env.location.href = `https://pugurin.vercel.app/auth/callback?code=abc&state=${state}`;
    expect(oauth.finish()).toEqual({
      provider: "google",
      code: "abc",
      state,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    });
    expect(env.location.href).toBe("https://pugurin.vercel.app/");
    expect(store.has("pugurin.oauth")).toBe(false);
    // 한 번 쓴 코드는 다시 꺼내지 않는다
    expect(oauth.finish()).toBeNull();
  });

  it("카카오·네이버는 PKCE를 쓰지 않는다", async () => {
    const { env, store } = browser();
    const oauth = new RedirectOAuth(config, env);
    await oauth.start("kakao");
    expect(new URL(env.location.href).searchParams.has("code_challenge")).toBe(
      false,
    );
    const { state } = JSON.parse(store.get("pugurin.oauth")!);
    env.location.href = `https://pugurin.vercel.app/auth/callback?code=abc&state=${state}`;
    expect(oauth.finish()).not.toHaveProperty("code_verifier");
  });

  it("콜백 주소가 아니면 아무것도 하지 않는다", () => {
    const { env } = browser("https://pugurin.vercel.app/?code=abc&state=x");
    expect(new RedirectOAuth(config, env).finish()).toBeNull();
    expect(env.location.href).toBe(
      "https://pugurin.vercel.app/?code=abc&state=x",
    );
  });

  it("state가 다르거나 시작 기록이 없으면 막는다", async () => {
    const { env } = browser();
    const oauth = new RedirectOAuth(config, env);
    await oauth.start("kakao");
    env.location.href =
      "https://pugurin.vercel.app/auth/callback?code=abc&state=other";
    expect(() => oauth.finish()).toThrow(ApiError);
    env.location.href =
      "https://pugurin.vercel.app/auth/callback?code=abc&state=other";
    expect(() => oauth.finish()).toThrow("다시 로그인해 주세요");
  });

  it("사용자가 동의를 취소하면 취소로 알린다", async () => {
    const { env, store } = browser();
    const oauth = new RedirectOAuth(config, env);
    await oauth.start("naver");
    const { state } = JSON.parse(store.get("pugurin.oauth")!);
    env.location.href = `https://pugurin.vercel.app/auth/callback?error=access_denied&state=${state}`;
    expect(() => oauth.finish()).toThrow("로그인을 취소했어요");
  });

  it("제공자 키가 설정되지 않았으면 이동하지 않고 알린다", async () => {
    const { env } = browser();
    const oauth = new RedirectOAuth({ ...config, clientIds: {} }, env);
    await expect(oauth.start("naver")).rejects.toThrow(
      "네이버 로그인은 아직 준비 중이에요",
    );
    expect(env.location.href).toBe("https://pugurin.vercel.app/");
  });
});
