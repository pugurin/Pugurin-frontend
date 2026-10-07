import type { Envelope } from "./types";
export class ApiError extends Error {
  constructor(
    message: string,
    public code = "NETWORK_ERROR",
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export class ApiClient {
  private cache = new Map<string, { etag: string; body: Envelope<unknown> }>();
  constructor(
    private base: string,
    private deviceId: string,
    private fetcher: typeof fetch = fetch,
  ) {}
  async get<T>(path: string, signal?: AbortSignal): Promise<Envelope<T>> {
    const cached = this.cache.get(path);
    const headers: Record<string, string> = {
      "X-Device-Id": this.deviceId,
      Accept: "application/json",
    };
    if (cached) headers["If-None-Match"] = cached.etag;
    let response: Response;
    try {
      response = await this.fetcher.call(
        globalThis,
        `${this.base.replace(/\/$/, "")}${path}`,
        { headers, signal },
      );
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
    if (!response.ok)
      throw new ApiError(
        body.error?.message ?? "정보를 불러올 수 없어요",
        body.error?.code ??
          (response.status === 404 ? "RESOURCE_NOT_FOUND" : "SERVER_ERROR"),
        Number(response.headers.get("Retry-After")) || undefined,
      );
    const mode = response.headers.get("X-Data-Mode");
    if (mode) body.meta = { ...body.meta, data_mode: mode };
    const etag = response.headers.get("ETag");
    if (etag) this.cache.set(path, { etag, body });
    return body;
  }
}
