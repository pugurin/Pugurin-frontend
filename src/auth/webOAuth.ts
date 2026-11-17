// 웹 소셜 로그인(인가 코드 + 리다이렉트). 같은 창에서 소셜 로그인으로 갔다가 /auth/callback으로 돌아온다.
// 팝업은 쓰지 않는다: 구글 등 로그인 페이지의 COOP 정책 때문에 팝업과 원래 창의 연결이 끊길 수 있다.
// - state: 다른 사이트가 우리 콜백으로 남의 코드를 넣는 것(CSRF)을 막는다. 시작할 때 만들어 세션 저장소에 두고 콜백에서 비교한다
// - PKCE: 구글은 백엔드가 필수로 요구한다(docs/AUTH.md). 카카오·네이버는 쓰지 않는다
import { ApiError } from "../api/client";
import { PROVIDER, type Provider } from "../api/authTypes";

export type OAuthConfig = {
  // 백엔드 허용 목록(PUGURIN_AUTH_REDIRECT_URIS)과 글자 하나까지 같아야 한다
  redirectUri: string;
  // 공개 클라이언트 ID(비밀값이 아니다). 카카오는 REST API 키가 client_id다
  clientIds: Partial<Record<Provider, string>>;
};
// 콜백에서 꺼낸 값. 백엔드 POST /auth/oauth/{provider}에 그대로 넘긴다
export type WebCallback = {
  provider: Provider;
  code: string;
  state: string;
  redirect_uri: string;
  code_verifier?: string;
};
export interface OAuthRedirect {
  start(provider: Provider): Promise<void>;
  finish(): WebCallback | null;
}
type BrowserEnv = {
  location: { href: string; assign(url: string): void };
  history: { replaceState(data: unknown, unused: string, url: string): void };
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};
type Pending = { provider: Provider; state: string; verifier?: string };

export const CALLBACK_PATH = "/auth/callback";
const PENDING_KEY = "pugurin.oauth";
const PKCE: Provider[] = ["google"];
const AUTHORIZE: Record<Provider, string> = {
  kakao: "https://kauth.kakao.com/oauth/authorize",
  naver: "https://nid.naver.com/oauth2.0/authorize",
  google: "https://accounts.google.com/o/oauth2/v2/auth",
};

// Expo는 process.env.EXPO_PUBLIC_*를 글자 그대로 쓸 때만 빌드에 넣는다. 그래서 하나씩 적는다
export function webOAuthConfig(origin: string): OAuthConfig {
  return {
    redirectUri: `${origin}${CALLBACK_PATH}`,
    clientIds: {
      kakao: process.env.EXPO_PUBLIC_KAKAO_REST_KEY || undefined,
      naver: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || undefined,
      google: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || undefined,
    },
  };
}

export function authorizeUrl(
  provider: Provider,
  config: OAuthConfig,
  state: string,
  challenge?: string,
) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientIds[provider] ?? "",
    redirect_uri: config.redirectUri,
    state,
  });
  // 구글 실명(name)은 백엔드가 저장하지 않지만, 로그인에 openid가 필요하다
  if (provider === "google") params.set("scope", "openid profile");
  if (challenge) {
    params.set("code_challenge", challenge);
    params.set("code_challenge_method", "S256");
  }
  return `${AUTHORIZE[provider]}?${params}`;
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
// 추측할 수 없는 임의 문자열. 32바이트면 43자로 PKCE verifier 길이(43~128)에 맞는다
export const randomToken = (bytes = 32) =>
  base64url(crypto.getRandomValues(new Uint8Array(bytes)));
export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

const again = (message: string) =>
  new ApiError(`${message} 다시 로그인해 주세요`, "UNAUTHORIZED");

export class RedirectOAuth implements OAuthRedirect {
  constructor(
    private config: OAuthConfig,
    private env: BrowserEnv,
  ) {}
  async start(provider: Provider) {
    if (!this.config.clientIds[provider])
      throw new ApiError(
        `${PROVIDER[provider].name} 로그인은 아직 준비 중이에요`,
        "SOURCE_UNAVAILABLE",
      );
    const pending: Pending = { provider, state: randomToken() };
    if (PKCE.includes(provider)) pending.verifier = randomToken();
    const challenge = pending.verifier
      ? await pkceChallenge(pending.verifier)
      : undefined;
    this.env.storage.setItem(PENDING_KEY, JSON.stringify(pending));
    this.env.location.assign(
      authorizeUrl(provider, this.config, pending.state, challenge),
    );
  }
  // 콜백 주소면 코드를 꺼내고 주소창을 첫 화면으로 되돌린다(새로 고쳐도 코드를 다시 쓰지 않게)
  finish(): WebCallback | null {
    const url = new URL(this.env.location.href);
    if (url.pathname !== CALLBACK_PATH) return null;
    this.env.history.replaceState(null, "", "/");
    const raw = this.env.storage.getItem(PENDING_KEY);
    this.env.storage.removeItem(PENDING_KEY);
    const pending = raw ? (JSON.parse(raw) as Pending) : null;
    const q = url.searchParams;
    if (!pending) throw again("로그인 정보가 없어요.");
    if (q.get("state") !== pending.state)
      throw again("로그인 확인 값이 맞지 않아요.");
    if (q.get("error") || !q.get("code"))
      throw new ApiError("로그인을 취소했어요", "CANCELLED");
    return {
      provider: pending.provider,
      code: q.get("code")!,
      state: pending.state,
      redirect_uri: this.config.redirectUri,
      ...(pending.verifier ? { code_verifier: pending.verifier } : {}),
    };
  }
}
