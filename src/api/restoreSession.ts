import { ApiError } from "./client";
import type { AuthApi, Session, StoredSession } from "./authTypes";

// 앱을 열 때 저장한 세션을 인증 서버에 확인한다.
// - 확인되면 onSession, 401이면 onClear(저장한 세션을 지운다)
// - 네트워크·서버 오류면 저장한 세션은 두고 retries번 더 확인한 뒤 onGiveUp
// - 그 사이 사용자가 로그인·로그아웃해서 isCurrent()가 false가 되면 결과를 버린다
export function restoreSession({
  auth,
  saved,
  refreshToken,
  isCurrent,
  onSession,
  onClear,
  onGiveUp,
  retries = 2,
  retryMs = 5000,
}: {
  auth: AuthApi;
  saved: StoredSession;
  refreshToken?: string;
  isCurrent: () => boolean;
  onSession: (session: Session) => void;
  onClear: () => void;
  onGiveUp: () => void;
  retries?: number;
  retryMs?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const attempt = (left: number) => {
    auth
      .restore(saved, refreshToken)
      .then((next) => {
        if (!stopped && isCurrent()) onSession(next);
      })
      .catch((e) => {
        if (stopped || !isCurrent()) return;
        if (e instanceof ApiError && e.code === "UNAUTHORIZED") onClear();
        else if (left > 0) timer = setTimeout(() => attempt(left - 1), retryMs);
        else onGiveUp();
      });
  };
  attempt(retries);
  // 화면이 사라지면 남은 재시도를 멈춘다
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
