import React, {
  createContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { AppState } from "react-native";
import type { Repository } from "../api/repository";
import type { InterestKind } from "../api/types";

// 관심 등록(별 버튼) 상태. 앱을 켤 때 GET /interests로 단지·경매 id를 받아 두고,
// 별을 누르면 화면을 먼저 바꾼 뒤 서버에 보낸다.
// 별마다 요청은 한 번에 하나만 보내고, 끝나면 그사이 마지막으로 누른 상태만 이어서 보낸다.
// 실패하면 서버가 마지막으로 확인해 준 값으로 되돌리고 서버 메시지를 토스트로 띄운다
export type Interests = {
  has: (kind: InterestKind, id: string) => boolean;
  toggle: (kind: InterestKind, id: string) => void;
  // 관심 목록 화면이 받은 id를 알린다. GET /interests를 못 받았어도 목록의 별이 켜져 보인다
  learn: (kind: InterestKind, ids: string[]) => void;
  count: Record<InterestKind, number>;
};
const EMPTY: Interests = {
  has: () => false,
  toggle: () => {},
  learn: () => {},
  count: { complex: 0, auction: 0 },
};
export const InterestsContext = createContext<Interests>(EMPTY);

type Sets = Record<InterestKind, Set<string>>;
// 누른 적 있는 별 하나의 상태
type Entry = {
  kind: InterestKind;
  id: string;
  // 서버가 마지막으로 확인해 준 값. GET /interests를 받기 전에 누른 별은 아직 모른다(null)
  confirmed: boolean | null;
  // 처음 누르기 전 화면 값. 서버 값을 모르는 채로 실패했을 때 잠깐 보여 준다
  initial: boolean;
  // 사용자가 마지막으로 고른 값
  desired: boolean;
  // 요청이 나가 있는지
  busy: boolean;
};
const emptySets = (): Sets => ({ complex: new Set(), auction: new Set() });

export function useInterests(
  repo: Repository,
  notify: (m: string) => void,
  // 기기 id가 준비되기 전에는 서버에 묻지 않는다
  ready = true,
): Interests {
  const [version, rerender] = useReducer((x: number) => x + 1, 0);
  // 화면에 보이는 별
  const shown = useRef<Sets>(emptySets());
  const entries = useRef(new Map<string, Entry>());
  // GET /interests: 받았는지, 받는 중인지
  const loaded = useRef(false);
  const loading = useRef<AbortController | null>(null);
  // repo가 바뀌면 올린다. 이전 repo의 늦은 응답은 버린다
  const generation = useRef(0);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const show = (kind: InterestKind, id: string, on: boolean) => {
    if (shown.current[kind].has(id) === on) return;
    const next = new Set(shown.current[kind]);
    if (on) next.add(id);
    else next.delete(id);
    shown.current = { ...shown.current, [kind]: next };
    rerender();
  };

  const load = () => {
    if (!ready || loaded.current || loading.current) return;
    const a = new AbortController();
    const gen = generation.current;
    loading.current = a;
    repo
      .interestIds(a.signal)
      .then(({ data }) => {
        if (gen !== generation.current) return;
        loaded.current = true;
        const next: Sets = {
          complex: new Set(data.complexes),
          auction: new Set(data.auctions),
        };
        // 받는 사이에 누른 별은 누른 대로 둔다
        for (const e of entries.current.values()) {
          if (e.desired) next[e.kind].add(e.id);
          else next[e.kind].delete(e.id);
        }
        shown.current = next;
        rerender();
      })
      // 못 받으면 다음에 별을 누르거나 앱으로 돌아올 때 다시 받는다
      .catch(() => {})
      .finally(() => {
        if (loading.current === a) loading.current = null;
      });
  };

  useEffect(() => {
    generation.current += 1;
    loading.current?.abort();
    loading.current = null;
    loaded.current = false;
    entries.current = new Map();
    shown.current = emptySets();
    rerender();
    load();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => {
      sub.remove();
      loading.current?.abort();
    };
    // load는 repo·ready만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, ready]);

  // 별 하나의 요청을 차례로 보낸다. 나가 있는 요청이 있으면 끝난 뒤 마지막 상태만 보낸다
  const flush = (e: Entry) => {
    if (e.busy || e.desired === e.confirmed) return;
    const gen = generation.current;
    const target = e.desired;
    e.busy = true;
    repo.setInterest(e.kind, e.id, target).then(
      () => {
        if (gen !== generation.current) return;
        e.busy = false;
        e.confirmed = target;
        flush(e);
      },
      (err) => {
        if (gen !== generation.current) return;
        e.busy = false;
        notifyRef.current(err?.message ?? "관심 등록을 처리하지 못했어요");
        if (e.confirmed !== null) {
          e.desired = e.confirmed;
          show(e.kind, e.id, e.confirmed);
          return;
        }
        // 목록을 받기 전에 누른 별이라 서버 값을 모른다. 누르기 전 값으로 두고 목록을 다시 받아 맞춘다
        // (이미 담긴 단지를 꺼짐으로 잘못 되돌리지 않게)
        entries.current.delete(`${e.kind}:${e.id}`);
        show(e.kind, e.id, e.initial);
        loaded.current = false;
        load();
      },
    );
  };

  return useMemo<Interests>(() => {
    const toggle = (kind: InterestKind, id: string) => {
      load();
      const key = `${kind}:${id}`;
      const now = shown.current[kind].has(id);
      let e = entries.current.get(key);
      if (!e) {
        e = {
          kind,
          id,
          confirmed: loaded.current ? now : null,
          initial: now,
          desired: now,
          busy: false,
        };
        entries.current.set(key, e);
      }
      e.desired = !now;
      show(kind, id, e.desired);
      flush(e);
    };
    const learn = (kind: InterestKind, ids: string[]) => {
      const missing = ids.filter(
        (id) =>
          !shown.current[kind].has(id) && !entries.current.has(`${kind}:${id}`),
      );
      if (!missing.length) return;
      const next = new Set(shown.current[kind]);
      missing.forEach((id) => next.add(id));
      shown.current = { ...shown.current, [kind]: next };
      rerender();
    };
    return {
      has: (kind, id) => shown.current[kind].has(id),
      toggle,
      learn,
      count: {
        complex: shown.current.complex.size,
        auction: shown.current.auction.size,
      },
    };
    // 상태는 ref에 있고 version이 바뀔 때만 새 값을 낸다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, repo, ready]);
}

export function InterestsProvider({
  value,
  children,
}: {
  value: Interests;
  children: React.ReactNode;
}) {
  return (
    <InterestsContext.Provider value={value}>
      {children}
    </InterestsContext.Provider>
  );
}
