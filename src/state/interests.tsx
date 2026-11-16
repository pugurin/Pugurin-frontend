import React, { createContext, useEffect, useRef, useState } from "react";
import type { Repository } from "../api/repository";
import type { InterestKind } from "../api/types";

// 관심 등록(별 버튼) 상태. 앱을 켤 때 GET /interests로 단지·경매 id를 받아 두고,
// 별을 누르면 화면을 먼저 바꾼 뒤 서버에 보낸다. 실패하면 되돌리고 서버 메시지를 토스트로 띄운다
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
const withId = (sets: Sets, kind: InterestKind, id: string, on: boolean) => {
  const next = new Set(sets[kind]);
  if (on) next.add(id);
  else next.delete(id);
  return { ...sets, [kind]: next };
};

export function useInterests(
  repo: Repository,
  notify: (m: string) => void,
  // 기기 id가 준비되기 전에는 서버에 묻지 않는다
  ready = true,
): Interests {
  const [sets, setSets] = useState<Sets>({
    complex: new Set(),
    auction: new Set(),
  });
  // 최신 상태를 눌림 처리에서 바로 읽는다(연타해도 직전 누름을 기준으로 뒤집는다)
  const current = useRef(sets);
  current.current = sets;
  // 별마다 마지막 누름 번호. 늦게 실패한 이전 요청이 더 새로운 누름을 되돌리지 않게 한다
  const seq = useRef(new Map<string, number>());
  useEffect(() => {
    const a = new AbortController();
    const empty: Sets = { complex: new Set(), auction: new Set() };
    current.current = empty;
    setSets(empty);
    seq.current.clear();
    if (!ready) return;
    repo
      .interestIds(a.signal)
      .then(({ data }) => {
        if (a.signal.aborted) return;
        // 받는 사이에 누른 별은 누른 대로 둔다
        const pressed = (kind: InterestKind, ids: string[]) => {
          const next = new Set(ids);
          for (const [key] of seq.current) {
            const [k, id] = key.split(/:(.*)/s);
            if (k !== kind) continue;
            if (current.current[kind].has(id)) next.add(id);
            else next.delete(id);
          }
          return next;
        };
        const next = {
          complex: pressed("complex", data.complexes),
          auction: pressed("auction", data.auctions),
        };
        current.current = next;
        setSets(next);
      })
      // 못 받아도 별은 빈 상태로 쓸 수 있다. 누르면 서버가 다시 알려 준다
      .catch(() => {});
    return () => a.abort();
  }, [repo, ready]);
  const toggle = (kind: InterestKind, id: string) => {
    const key = `${kind}:${id}`;
    const on = !current.current[kind].has(id);
    const n = (seq.current.get(key) ?? 0) + 1;
    seq.current.set(key, n);
    const apply = (value: boolean) => {
      current.current = withId(current.current, kind, id, value);
      setSets(current.current);
    };
    apply(on);
    repo.setInterest(kind, id, on).catch((e) => {
      if (seq.current.get(key) !== n) return;
      apply(!on);
      notify(e?.message ?? "관심 등록을 처리하지 못했어요");
    });
  };
  const learn = (kind: InterestKind, ids: string[]) => {
    const missing = ids.filter(
      (id) =>
        !current.current[kind].has(id) && !seq.current.has(`${kind}:${id}`),
    );
    if (!missing.length) return;
    const next = new Set(current.current[kind]);
    missing.forEach((id) => next.add(id));
    current.current = { ...current.current, [kind]: next };
    setSets(current.current);
  };
  return {
    has: (kind, id) => sets[kind].has(id),
    toggle,
    learn,
    count: { complex: sets.complex.size, auction: sets.auction.size },
  };
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
