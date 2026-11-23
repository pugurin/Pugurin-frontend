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
// 로그인한 사용자의 access token. 관심 목록처럼 로그인이 필요한 요청에 쓴다
export type ClientAuth = {
  // 지금 토큰. 로그인하지 않았으면 undefined
  token: () => string | undefined;
  // 만료됐을 때(401) 새 토큰을 받는다. 못 받으면 undefined를 주거나 던진다
  refresh: () => Promise<string | undefined>;
};
export class ApiClient {
  private cache = new Map<string, { etag: string; body: Envelope<unknown> }>();
  constructor(
    private base: string,
    private deviceId: string,
    private fetcher: typeof fetch = fetch,
    private auth?: ClientAuth,
  ) {}
  // 로그인했으면 Bearer 토큰을 붙여 보내고, 401이면 토큰을 한 번 갱신해 다시 보낸다
  private async fetchAuthed(
    path: string,
    init: RequestInit & { headers: Record<string, string> },
  ): Promise<Response> {
    const url = `${this.base.replace(/\/$/, "")}${path}`;
    const token = this.auth?.token();
    const go = (t?: string) =>
      this.fetcher.call(globalThis, url, {
        ...init,
        headers: t
          ? { ...init.headers, Authorization: `Bearer ${t}` }
          : init.headers,
      });
    const response = await go(token);
    if (response.status !== 401 || !token || !this.auth) return response;
    let fresh: string | undefined;
    try {
      fresh = await this.auth.refresh();
    } catch {
      return response;
    }
    return fresh ? go(fresh) : response;
  }
  // 쓰기 요청(관심 등록 PUT·해제 DELETE, 알림 읽음 POST). 204는 본문이 없어 null을 준다
  // body를 주면 JSON으로 보낸다
  async send<T>(
    method: "PUT" | "DELETE" | "POST",
    path: string,
    body?: unknown,
  ): Promise<Envelope<T> | null> {
    let response: Response;
    try {
      response = await this.fetchAuthed(path, {
        method,
        headers: {
          "X-Device-Id": this.deviceId,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
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
  async get<T>(path: string, signal?: AbortSignal): Promise<Envelope<T>> {
    const cached = this.cache.get(path);
    const headers: Record<string, string> = {
      "X-Device-Id": this.deviceId,
      Accept: "application/json",
    };
    if (cached) headers["If-None-Match"] = cached.etag;
    let response: Response;
    try {
      response = await this.fetchAuthed(path, { headers, signal });
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
