import { createContext, useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "../api/auth";
import { ApiError } from "../api/client";
import type {
  ComplexInput,
  ComplexInterest,
  InterestsApi,
  RegionInput,
  RegionInterest,
} from "../api/interests";

export const REGION_LIMIT = 10;
// 법정동 코드는 10자리, 시·군·구는 5자리
export const isDong = (code: string) => code.length === 10;

// 로그인한 사람의 관심 단지·지역. App이 만들어 시트·목록 화면에 내려 준다
export type InterestsValue = {
  // 관심 기능을 연 빌드인지. 아니면 ☆는 비활성 모양이고 누르면 준비 중 안내만 한다
  enabled: boolean;
  signedIn: boolean;
  complexes: ComplexInterest[];
  regions: RegionInterest[];
  // 등록·해제 요청 중인 항목 키("complex:<id>", "region:<code>")
  busy: string[];
  hasComplex(id: string): boolean;
  hasRegion(code: string): boolean;
  toggleComplex(c: ComplexInput): Promise<void>;
  toggleRegion(r: RegionInput): Promise<void>;
};
const noop = async () => {};
export const InterestsContext = createContext<InterestsValue>({
  enabled: false,
  signedIn: false,
  complexes: [],
  regions: [],
  busy: [],
  hasComplex: () => false,
  hasRegion: () => false,
  toggleComplex: noop,
  toggleRegion: noop,
});
export const InterestsProvider = InterestsContext.Provider;

// api가 null이면 관심 기능을 열지 않은 빌드다(진짜 로그인이 먼저 붙어도 기기에만 저장되지 않게)
export function useInterestsState(
  api: InterestsApi | null,
  session: Session | null,
  notify: (message: string) => void,
  onLogin: () => void,
): InterestsValue {
  const [complexes, setComplexes] = useState<ComplexInterest[]>([]);
  const [regions, setRegions] = useState<RegionInterest[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  // 계정이 바뀐 뒤 늦게 온 응답은 버린다
  const current = useRef<Session | null>(session);
  current.current = session;
  const userId = session?.user.id;
  const reload = useCallback(
    async (s: Session) => {
      if (!api) return;
      const [c, r] = await Promise.all([
        api.listComplexes(s),
        api.listRegions(s),
      ]);
      if (current.current?.user.id !== s.user.id) return;
      setComplexes(c);
      setRegions(r);
    },
    [api],
  );
  useEffect(() => {
    setComplexes([]);
    setRegions([]);
    setBusy([]);
    if (session) reload(session).catch(() => {});
    // 세션 토큰이 바뀌어도 같은 사용자면 다시 부르지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reload]);

  const run = async (
    key: string,
    action: (api: InterestsApi, s: Session) => Promise<void>,
    done: string,
  ) => {
    // 관심 기능을 열지 않은 빌드면 App이 준비 중이라고 알린다
    if (!api) return onLogin();
    const s = current.current;
    if (!s) {
      notify("로그인하면 관심 등록할 수 있어요");
      onLogin();
      return;
    }
    if (busy.includes(key)) return;
    setBusy((b) => [...b, key]);
    try {
      await action(api, s);
      await reload(s);
      notify(done);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요");
    } finally {
      setBusy((b) => b.filter((k) => k !== key));
    }
  };
  const hasComplex = (id: string) => complexes.some((c) => c.complex_id === id);
  const hasRegion = (code: string) =>
    regions.some((r) => r.region_code === code);
  return {
    enabled: !!api,
    signedIn: !!api && !!session,
    complexes,
    regions,
    busy,
    hasComplex,
    hasRegion,
    toggleComplex: (c) =>
      hasComplex(c.complex_id)
        ? run(
            `complex:${c.complex_id}`,
            (a, s) => a.removeComplex(s, c.complex_id),
            "관심 단지에서 뺐어요",
          )
        : run(
            `complex:${c.complex_id}`,
            (a, s) => a.addComplex(s, c),
            "관심 단지에 담았어요",
          ),
    toggleRegion: (r) =>
      hasRegion(r.region_code)
        ? run(
            `region:${r.region_code}`,
            (a, s) => a.removeRegion(s, r.region_code),
            "관심 지역에서 뺐어요",
          )
        : run(
            `region:${r.region_code}`,
            (a, s) => a.addRegion(s, r),
            "관심 지역에 담았어요",
          ),
  };
}
