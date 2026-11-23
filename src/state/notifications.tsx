import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Repository } from "../api/repository";

// 안 읽은 알림 수. 로그인하지 않았으면 0이고 서버에 묻지 않는다.
// 계정이 바뀌거나 앱이 다시 활성화될 때 notifications(1)의 meta.unread_count를 다시 받는다.
// 리포트를 읽은 뒤에는 refresh로 배지를 바로 줄인다
export function useUnreadCountState(repo: Repository, account: string | null) {
  const [count, setCount] = useState(0);
  const ctl = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    ctl.current?.abort();
    if (account === null) {
      ctl.current = null;
      setCount(0);
      return;
    }
    const a = new AbortController();
    ctl.current = a;
    repo
      .notifications(1, a.signal)
      .then((r) => {
        if (!a.signal.aborted)
          setCount((r.meta as { unread_count?: number }).unread_count ?? 0);
      })
      // 못 받으면 배지를 그대로 둔다
      .catch(() => {});
  }, [repo, account]);
  useEffect(() => {
    // 계정이 바뀌면 이전 계정의 숫자를 먼저 지운다
    setCount(0);
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      sub.remove();
      ctl.current?.abort();
    };
  }, [refresh]);
  return { count, refresh };
}

export function useUnreadCount(repo: Repository, account: string | null) {
  return useUnreadCountState(repo, account).count;
}
