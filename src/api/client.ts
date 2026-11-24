import type { Envelope } from "./types";
// 실데이터 수집·적재 전이면 서버가 503 DATA_NOT_READY로 답한다
export const DATA_NOT_READY_MESSAGE =
  "데이터를 준비 중이에요. 수집이 끝나면 거래가 표시돼요";
export class ApiError extends Error {
  constructor(
    message: string,
    public code = "NETWORK_ERROR",
    public retryAfter?: number,
  ) {
    super(message);
  }
}
// 로그인한 사용자의 access token. 관심 목록처럼 로그인이 필요한 요청에만 붙인다
export type ClientAuth = {
  // 지금 토큰. 로그인하지 않았으면 undefined
  token: () => string | undefined;
  // 지금 로그인한 계정 id. 요청 중에 계정이 바뀌면 새 계정 토큰으로 다시 보내지 않는다
  account: () => string | undefined;
  // 만료됐을 때(401) 새 토큰을 받는다(used: 401을 받은 토큰). 못 받으면 던진다
  refresh: (used: string) => Promise<string>;
  // 갱신이 401로 끝났다(만료·폐기). 세션을 지우고 다시 로그인하게 한다
  expired: () => void;
};
export class ApiClient {
  private cache = new Map<string, { etag: string; body: Envelope<unknown> }>();
  constructor(
    private base: string,
    private deviceId: string,
    private fetcher: typeof fetch = fetch,
    private auth?: ClientAuth,
  ) {}
  // authed면 로그인했을 때 Bearer 토큰을 붙인다. 401이면 한 번만 다시 보낸다:
  // - 그사이 다른 요청이 이미 갱신했으면 그 토큰으로(갱신을 또 보내지 않는다)
  // - 아니면 갱신해서. 갱신이 401이어도 그사이 먼저 끝난 갱신이 있으면 그 토큰으로(유예 안 동시 갱신)
  // - 갱신이 401로 끝나면 세션이 끝난 것이라 expired로 알린다
  // 요청을 보낸 뒤 다른 계정으로 바뀌었으면 다시 보내지 않는다
  private async fetchAuthed(
    path: string,
    init: RequestInit & { headers: Record<string, string> },
    authed: boolean,
  ): Promise<Response> {
    const url = `${this.base.replace(/\/$/, "")}${path}`;
    const auth = authed ? this.auth : undefined;
    const token = auth?.token();
    // 요청을 시작할 때의 계정
    const account = auth?.account();
    const go = (t?: string) =>
      this.fetcher.call(globalThis, url, {
        ...init,
        headers: t
          ? { ...init.headers, Authorization: `Bearer ${t}` }
          : init.headers,
      });
    const response = await go(token);
    if (response.status !== 401 || !token || !auth) return response;
    const sameAccount = () => auth.account() === account;
    const newer = () => {
      const now = auth.token();
      return now && now !== token ? now : undefined;
    };
    if (!sameAccount()) return response;
    const already = newer();
    if (already) return go(already);
    let fresh: string;
    try {
      fresh = await auth.refresh(token);
    } catch (e) {
      if (!sameAccount()) return response;
      const other = newer();
      if (other) return go(other);
      if (e instanceof ApiError && e.code === "UNAUTHORIZED") auth.expired();
      return response;
    }
    return sameAccount() ? go(fresh) : response;
  }
  // 쓰기 요청(관심 등록 PUT·해제 DELETE, 알림 읽음 POST). 로그인이 필요해 토큰을 붙인다.
  // 204는 본문이 없어 null을 준다. body를 주면 JSON으로 보낸다
  async send<T>(
    method: "PUT" | "DELETE" | "POST",
    path: string,
    body?: unknown,
  ): Promise<Envelope<T> | null> {
    let response: Response;
    try {
      response = await this.fetchAuthed(
        path,
        {
          method,
          headers: {
            "X-Device-Id": this.deviceId,
            Accept: "application/json",
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        },
        true,
      );
    } catch {
      throw new ApiError(
        "네트워크에 연결할 수 없어요. 연결 상태를 확인해 주세요",
      );
    }
    if (response.status === 204) return null;
    let result: any;
    try {
      result = await response.json();
    } catch {
      throw new ApiError("서버 응답을 읽을 수 없어요", "INVALID_RESPONSE");
    }
    if (!response.ok) {
      const code =
        result?.error?.code ??
        (response.status === 404 ? "RESOURCE_NOT_FOUND" : "SERVER_ERROR");
      throw new ApiError(
        code === "DATA_NOT_READY"
          ? DATA_NOT_READY_MESSAGE
          : (result?.error?.message ?? "요청을 처리할 수 없어요"),
        code,
        Number(response.headers.get("Retry-After")) || undefined,
      );
    }
    return result;
  }
  // auth: 로그인이 필요한 읽기(관심 목록). 지도·검색 같은 공개 읽기에는 토큰을 붙이지 않는다
  async get<T>(
    path: string,
    signal?: AbortSignal,
    opts: { auth?: boolean } = {},
  ): Promise<Envelope<T>> {
    const cached = this.cache.get(path);
    const headers: Record<string, string> = {
      "X-Device-Id": this.deviceId,
      Accept: "application/json",
    };
    if (cached) headers["If-None-Match"] = cached.etag;
    let response: Response;
    try {
      response = await this.fetchAuthed(path, { headers, signal }, !!opts.auth);
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new ApiError(
        "네트워크에 연결할 수 없어요. 연결 상태를 확인해 주세요",
      );
    }
    if (response.status === 304 && cached) return cached.body as Envelope<T>;
    let body: any;
    try {
      body = await response.json();
    } catch {
      throw new ApiError("서버 응답을 읽을 수 없어요", "INVALID_RESPONSE");
    }
    if (!response.ok) {
      const code =
        body.error?.code ??
        (response.status === 404 ? "RESOURCE_NOT_FOUND" : "SERVER_ERROR");
      throw new ApiError(
        code === "DATA_NOT_READY"
          ? DATA_NOT_READY_MESSAGE
          : (body.error?.message ?? "정보를 불러올 수 없어요"),
        code,
        Number(response.headers.get("Retry-After")) || undefined,
      );
    }
    const mode = response.headers.get("X-Data-Mode");
    if (mode) body.meta = { ...body.meta, data_mode: mode };
    const etag = response.headers.get("ETag");
    if (etag) this.cache.set(path, { etag, body });
    return body;
  }
}
