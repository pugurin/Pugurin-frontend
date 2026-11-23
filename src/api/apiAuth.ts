// 실제 인증 서버(백엔드 docs/AUTH.md, API 명세 §8)에 붙는 인증.
// - 웹(X-Client: web): 소셜 로그인으로 이동했다가 돌아온 인가 코드를 POST /auth/oauth/{provider}로 넘긴다.
//   refresh token은 httpOnly 쿠키로만 오가고, access token은 메모리에만 둔다
// - 앱(X-Client: app): 소셜 SDK가 준 토큰을 넘긴다(src/auth/socialLogin.native.ts).
//   refresh token은 본문으로 받고, 갱신할 때마다 새 값으로 바뀐다(onTokens로 보안 저장소에 저장)
// - 갱신은 한 번에 하나만 보낸다. 같은 토큰을 두 번 보내면 늦은 쪽이 401이 된다
import { ApiError } from "./client";
import type { OAuthRedirect, WebCallback } from "../auth/webOAuth";
import {
  type Agreements,
  type AuthApi,
  type Provider,
  type Session,
  type SignInResult,
  type StoredSession,
  type User,
} from "./authTypes";

type ApiUser = Omit<User, "marketing_push"> & {
  consents?: { marketing_push?: boolean };
};
type Tokens = {
  is_new_user: false;
  access_token: string;
  refresh_token?: string | null;
  user: ApiUser;
};
// 앱 소셜 로그인. SDK가 준 access token을 돌려준다
export type SocialLogin = { start(provider: Provider): Promise<string> };
export type TokenPair = { access_token: string; refresh_token: string };
type NewUser = {
  is_new_user: true;
  signup_token: string;
  profile?: { nickname?: string | null };
};

// 서버 사용자 → 앱 사용자. 마케팅 동의는 consents 안에 있다
const toUser = (u: ApiUser): User => ({
  id: u.id,
  nickname: u.nickname,
  provider: u.provider,
  role: u.role,
  marketing_push: u.consents?.marketing_push ?? false,
  created_at: u.created_at,
});

export class ApiAuth implements AuthApi {
  readonly source = "api" as const;
  private base: string;
  private deviceId: () => string | Promise<string>;
  private oauth?: OAuthRedirect;
  private social?: SocialLogin;
  private client: "app" | "web";
  private onTokens?: (tokens: TokenPair, previous: string) => void;
  private fetcher: typeof fetch;
  // 가장 최근 access token. 화면이 가진 세션의 토큰이 만료돼 갱신하면 이 값을 쓴다
  private access?: string;
  private refreshing?: Promise<string>;
  // 앱: 가장 최근 refresh token과 갱신으로 바뀐 값(이전 → 새).
  // 폐기된 토큰을 다시 보내면 서버가 그 사용자의 모든 기기를 로그아웃시키므로, 오래된 값이 와도 새 값으로 보낸다
  private refreshToken = "";
  private rotated = new Map<string, string>();
  constructor(opts: {
    base: string;
    deviceId: () => string | Promise<string>;
    // 웹은 oauth(리다이렉트), 앱은 social(SDK 토큰)
    oauth?: OAuthRedirect;
    social?: SocialLogin;
    client?: "app" | "web";
    // 앱: 갱신으로 refresh token이 바뀔 때마다 부른다(previous: 바뀌기 전 값). 보안 저장소에 바로 저장한다
    onTokens?: (tokens: TokenPair, previous: string) => void;
    fetcher?: typeof fetch;
  }) {
    this.base = opts.base.replace(/\/$/, "");
    this.deviceId = opts.deviceId;
    this.oauth = opts.oauth;
    this.social = opts.social;
    this.client = opts.client ?? "web";
    this.onTokens = opts.onTokens;
    this.fetcher = opts.fetcher ?? fetch;
  }
  private get app() {
    return this.client === "app";
  }
  private latest(token: string) {
    let t = token;
    while (this.rotated.has(t)) t = this.rotated.get(t)!;
    return t;
  }

  private async call<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<T | undefined> {
    const headers: Record<string, string> = {
      "X-Device-Id": await this.deviceId(),
      "X-Client": this.client,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    let response: Response;
    try {
      response = await this.fetcher.call(globalThis, `${this.base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
      });
    } catch {
      throw new ApiError(
        "네트워크에 연결할 수 없어요. 연결 상태를 확인해 주세요",
      );
    }
    if (response.status === 204) return undefined;
    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new ApiError("서버 응답을 읽을 수 없어요", "INVALID_RESPONSE");
    }
    if (!response.ok) {
      const code =
        json?.error?.code ??
        (response.status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR");
      throw new ApiError(
        json?.error?.message ?? "요청을 처리하지 못했어요",
        code,
      );
    }
    return json.data as T;
  }

  // 웹은 쿠키로, 앱은 본문의 refresh token으로 갱신한다
  private refresh(refreshToken?: string): Promise<string> {
    if (this.refreshing) return this.refreshing;
    const previous = this.latest(refreshToken || this.refreshToken);
    if (this.app && !previous)
      return Promise.reject(
        new ApiError("다시 로그인해 주세요", "UNAUTHORIZED"),
      );
    this.refreshing = this.call<{
      access_token: string;
      refresh_token?: string | null;
    }>(
      "POST",
      "/auth/refresh",
      this.app ? { refresh_token: previous } : undefined,
    )
      .then((r) => {
        this.access = r!.access_token;
        if (this.app) {
          const next = r!.refresh_token ?? "";
          this.rotated.set(previous, next);
          this.refreshToken = next;
          this.onTokens?.(
            { access_token: this.access, refresh_token: next },
            previous,
          );
        }
        return this.access;
      })
      .finally(() => (this.refreshing = undefined));
    return this.refreshing;
  }

  // 관심 목록처럼 데이터 API에 붙일 access token(가장 최근 것). 로그인 전·로그아웃 뒤엔 undefined
  accessToken(): string | undefined {
    return this.access;
  }

  // 데이터 API가 401을 받았을 때 쿠키로 갱신한다
  refreshAccess(): Promise<string> {
    return this.refresh();
  }

  // 로그인이 필요한 요청. access token이 만료됐으면(401) 한 번 갱신하고 다시 보낸다
  private async authed<T>(
    method: string,
    path: string,
    session: Session,
    body?: unknown,
  ) {
    const token = this.access ?? session.access_token;
    try {
      return await this.call<T>(method, path, body, token);
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== "UNAUTHORIZED") throw e;
      return this.call<T>(
        method,
        path,
        body,
        await this.refresh(session.refresh_token),
      );
    }
  }

  private session(r: Tokens): Session {
    this.access = r.access_token;
    // 웹 응답에는 refresh token이 없다(쿠키)
    this.refreshToken = this.app ? (r.refresh_token ?? "") : "";
    return {
      source: this.source,
      user: toUser(r.user),
      access_token: r.access_token,
      refresh_token: this.refreshToken,
    };
  }

  // 웹: 소셜 로그인 페이지로 이동한다. 페이지를 떠나므로 끝나지 않는다. 돌아오면 completeSignIn이 이어서 한다
  // 앱: 소셜 SDK로 로그인하고 받은 토큰으로 바로 로그인한다
  async signIn(provider: Provider): Promise<SignInResult> {
    if (this.social) {
      const access_token = await this.social.start(provider);
      return this.signInResult(provider, { access_token });
    }
    if (!this.oauth)
      throw new ApiError("로그인을 준비 중이에요", "SOURCE_UNAVAILABLE");
    await this.oauth.start(provider);
    return new Promise<SignInResult>(() => {});
  }

  // 앱을 열 때 부른다. 소셜 로그인에서 돌아온 게 아니면 null
  async completeSignIn(): Promise<SignInResult | null> {
    const cb: WebCallback | null = this.oauth?.finish() ?? null;
    if (!cb) return null;
    const { provider, ...body } = cb;
    return this.signInResult(provider, body);
  }

  private async signInResult(
    provider: Provider,
    body: object,
  ): Promise<SignInResult> {
    const r = await this.call<Tokens | NewUser>(
      "POST",
      `/auth/oauth/${provider}`,
      body,
    );
    if (!r)
      throw new ApiError("서버 응답을 읽을 수 없어요", "INVALID_RESPONSE");
    if (r.is_new_user)
      return {
        kind: "signup",
        signup_token: r.signup_token,
        provider,
        nickname: r.profile?.nickname ?? null,
      };
    return { kind: "session", session: this.session(r as Tokens) };
  }

  async signUp(
    signupToken: string,
    nickname: string,
    agreements: Agreements,
  ): Promise<Session> {
    const r = await this.call<Tokens>("POST", "/auth/signup", {
      signup_token: signupToken,
      nickname: nickname.trim(),
      agreements,
    });
    return this.session(r!);
  }

  async updateNickname(session: Session, nickname: string): Promise<User> {
    return toUser(
      (await this.authed<ApiUser>("PATCH", "/users/me", session, {
        nickname: nickname.trim(),
      }))!,
    );
  }

  async signOut(session?: Session): Promise<void> {
    // 갱신이 진행 중이면 끝나길 기다린다. 옛 토큰으로 로그아웃하면 서버에서 회전된 새 토큰이 살아남는다
    await this.refreshing?.catch(() => {});
    const refresh_token = this.latest(
      session?.refresh_token || this.refreshToken,
    );
    this.access = undefined;
    this.refreshToken = "";
    await this.call(
      "POST",
      "/auth/logout",
      this.app ? { refresh_token } : undefined,
    );
  }

  async withdraw(session: Session): Promise<void> {
    await this.authed("DELETE", "/users/me", session);
    this.access = undefined;
    this.refreshToken = "";
  }

  async restore(saved: StoredSession, refreshToken?: string): Promise<Session> {
    if (saved.source !== this.source)
      throw new ApiError("다시 로그인해 주세요", "UNAUTHORIZED");
    const access = await this.refresh(refreshToken);
    const me = await this.call<ApiUser>("GET", "/users/me", undefined, access);
    return {
      source: this.source,
      user: toUser(me!),
      access_token: access,
      refresh_token: this.app ? this.refreshToken : "",
    };
  }
}
