import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  View,
  useWindowDimensions,
} from "react-native";
import { useFonts } from "expo-font";
import { Repository, type Mode } from "./src/api/repository";
import { apiBase } from "./src/api/base";
import { ApiClient, ApiError, type ClientAuth } from "./src/api/client";
import type {
  BBox,
  Filters,
  SearchResult,
  Term,
  Meta,
  Parcel,
} from "./src/api/types";
import { DEFAULT_FILTERS, HOME } from "./src/state/market";
import {
  deviceId,
  loadStored,
  remember,
  store,
  type Recent,
} from "./src/state/storage";
import { C } from "./src/theme/tokens";
import { Icon, StateCard, T, s } from "./src/components/ui";
import { MapHome, type AuctionFocus, type Focus } from "./src/screens/MapHome";
import { FilterScreen } from "./src/screens/FilterScreen";
import { WebSearch } from "./src/components/WebSearch";
import { SearchScreen } from "./src/screens/SearchScreen";
import {
  GlossaryScreen,
  TermDetail,
  TermPopup,
} from "./src/screens/GlossaryScreen";
import {
  MoreScreen,
  TermsScreen,
  DataDateScreen,
  type TermKind,
} from "./src/screens/MoreScreen";
import { TransactionsScreen } from "./src/screens/TransactionsScreen";
import { AuctionsScreen } from "./src/screens/AuctionsScreen";
import { InterestsScreen } from "./src/screens/InterestsScreen";
import {
  NotificationsScreen,
  ReportScreen,
} from "./src/screens/NotificationsScreen";
import { useUnreadCountState } from "./src/state/notifications";
import { InterestsProvider, useInterests } from "./src/state/interests";
import type { InterestKind } from "./src/api/types";
import { Brand } from "./src/components/Brand";
import { LoadingTip } from "./src/components/LoadingTip";
import { LearningProvider } from "./src/glossary/LearningContext";
import { MatchingScreen } from "./src/screens/MatchingScreen";
import {
  loadMatchingRecord,
  matchingStatus,
  type MatchingRecord,
} from "./src/glossary/matching";
import { kstDateKey, todayLabel } from "./src/glossary/today";
import {
  SampleAuth,
  toStored,
  type AuthApi,
  type Session,
  type SignInResult,
  type StoredSession,
  type User,
} from "./src/api/auth";
import { restoreSession } from "./src/api/restoreSession";
import { ApiAuth, type TokenPair } from "./src/api/apiAuth";
import {
  CALLBACK_PATH,
  RedirectOAuth,
  webOAuthConfig,
} from "./src/auth/webOAuth";
import { socialLogin } from "./src/auth/socialLogin";
import { loadRefreshToken, saveRefreshToken } from "./src/state/secureToken";
import {
  AccountScreen,
  LoginScreen,
  LoginSheet,
  SignupDoneScreen,
  SignupScreen,
} from "./src/screens/AuthScreens";
import { CommuteScreen } from "./src/screens/Commute";
import {
  CommuteProvider,
  placeFromSearch,
  type Place,
} from "./src/state/commute";
type Route =
  // error: 웹 리다이렉트 로그인이 돌아와서 실패했을 때 안내
  | { kind: "login"; error?: string }
  // 가입 완료(자동으로 만든 닉네임 안내)
  // fromInbox: 알림함 위 로그인 시트에서 가입했으면 닫을 때 알림함으로 돌아간다
  | { kind: "joined"; user: User; fromInbox?: boolean }
  // 처음 로그인한 사람의 가입 마무리
  | {
      kind: "signup";
      signup: Extract<SignInResult, { kind: "signup" }>;
      fromInbox?: boolean;
    }
  | { kind: "account" }
  | { kind: "matching" }
  | { kind: "filter" }
  | { kind: "search" }
  | {
      kind: "term";
      term: Term;
      map: boolean;
      badge?: string;
      returnTo?: "matching";
    }
  | { kind: "terms"; name: TermKind }
  | { kind: "date" }
  | { kind: "interests"; tab: InterestKind }
  | { kind: "notifications" }
  | { kind: "notification"; id: string }
  | { kind: "transactions"; bbox: BBox; region?: string; name?: string }
  // 경매 목록. 단지 묶음 마커에서 열면 그 단지로 거른다
  | { kind: "auctions"; bbox: BBox; complexId?: string; name?: string }
  // 직장 고르기. home이 있으면 고른 뒤 그 집의 길찾기로 간다
  | { kind: "workplace"; home?: Place }
  // 집 → 직장 대중교통 길찾기
  | { kind: "commute"; home: Place };
// 백엔드 API 주소. 웹 운영은 Vercel 프록시(/api/v1)
const API_BASE = apiBase(
  process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API_BASE ||
    (Platform.OS === "web"
      ? "http://localhost:8001/api/v1"
      : Platform.OS === "android"
        ? "http://10.0.2.2:8000/api/v1"
        : "http://localhost:8000/api/v1"),
);
// 인증 서버. EXPO_PUBLIC_AUTH_MODE=sample이면 앱 안 가짜 서버, api면 실제 백엔드
// (웹은 리다이렉트, 앱은 카카오 SDK. 앱의 네이버·구글은 준비 중). 값이 없으면 로그인 카드가 "준비 중"으로 남는다
function makeAuth(
  onTokens: (tokens: TokenPair, previous: string) => void,
): AuthApi | null {
  const mode = process.env.EXPO_PUBLIC_AUTH_MODE;
  if (mode === "sample") return new SampleAuth();
  if (mode === "api" && Platform.OS !== "web")
    return new ApiAuth({
      base: API_BASE,
      deviceId,
      client: "app",
      social: socialLogin,
      onTokens,
    });
  if (mode === "api" && Platform.OS === "web")
    return new ApiAuth({
      base: API_BASE,
      deviceId,
      oauth: new RedirectOAuth(webOAuthConfig(window.location.origin), {
        location: window.location,
        history: window.history,
        storage: window.sessionStorage,
      }),
    });
  return null;
}

export default function App() {
  const [fonts] = useFonts({
    Pretendard: require("./assets/fonts/Pretendard-Regular.otf"),
    "Pretendard-Bold": require("./assets/fonts/Pretendard-Bold.otf"),
  });
  const [id, setId] = useState("");
  const [initError, setInitError] = useState<string | null>(null);
  const [dataMeta, setDataMeta] = useState<Meta>();
  const [mode, setMode] = useState<Mode>(
    process.env.EXPO_PUBLIC_DATA_MODE === "sample" ? "sample" : "api",
  );
  const [tab, setTab] = useState<"map" | "glossary" | "more">("map");
  const [route, setRoute] = useState<Route | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // 지도 경매 탭
  const [auction, setAuction] = useState(false);
  const [unit, setUnit] = useState<"평" | "㎡">("평");
  const [base, setBase] = useState<"normal" | "satellite">("normal");
  const [cad, setCad] = useState(false);
  // 지도 학교 레이어. 처음엔 꺼짐이고 켠 상태를 저장한다
  const [schools, setSchools] = useState(false);
  // 지도 병원 레이어. 학교처럼 처음엔 꺼짐이고 켠 상태를 저장한다
  const [hospitals, setHospitals] = useState(false);
  // 지도 재개발 레이어. 처음엔 꺼짐이고 켠 상태를 저장한다
  const [redevelopments, setRedevelopments] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  // 출퇴근 길찾기의 직장. 이 기기에만 저장한다
  const [workplace, setWorkplace] = useState<Place | null>(null);
  // 대중교통 길찾기. 백엔드(/transit/routes)가 준비될 때까지 실제 API 모드에서는 EXPO_PUBLIC_TRANSIT=on일 때만 켠다
  const transitEnabled =
    mode === "sample" || process.env.EXPO_PUBLIC_TRANSIT === "on";
  // 로그인 세션. 기기에 저장해 다음에 열어도 로그인이 유지된다(F-AUTH-02).
  // 어떤 인증 서버를 쓸지는 makeAuth가 정한다
  const [session, setSession] = useState<Session | null>(null);
  // 앱: 보안 저장소에 있는 refresh token. 갱신 결과가 지금 세션 것일 때만 바꿔 저장한다
  const storedRefresh = useRef<string | undefined>(undefined);
  const auth = useMemo(
    () =>
      makeAuth((tokens, previous) => {
        if ((storedRefresh.current ?? "") !== previous) return;
        storedRefresh.current = tokens.refresh_token;
        void saveRefreshToken(tokens.refresh_token || null);
        setSession((prev) =>
          prev && prev.refresh_token === previous
            ? { ...prev, ...tokens }
            : prev,
        );
      }),
    [],
  );
  // 세션을 바꿀 때마다 올린다. 늦게 끝난 복원이 더 새로운 로그인·로그아웃을 덮지 않게 한다
  const sessionVersion = useRef(0);
  const saveSession = (next: Session | null) => {
    sessionVersion.current += 1;
    setSession(next);
    storedRefresh.current = next?.refresh_token;
    void store("session", next && toStored(next));
    void saveRefreshToken(next?.refresh_token || null);
  };
  const [focus, setFocus] = useState<Focus>();
  // 경매 목록에서 고른 줄. 지도가 그 경매로 이동해 시트를 연다
  const [auctionFocus, setAuctionFocus] = useState<AuctionFocus | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [termsLoading, setTermsLoading] = useState(true);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termsRetry, setTermsRetry] = useState(0);
  const [popupAnchor, setPopupAnchor] = useState<{ x: number; y: number }>();
  const [popup, setPopup] = useState<Term | null>(null);
  const [toast, setToast] = useState("");
  // 오늘의 용어: 더보기에서 끄기(계속), ✕로 닫은 날(그날만). 둘 다 기기에 저장
  const [matchingRecord, setMatchingRecord] = useState<MatchingRecord | null>(
    null,
  );
  // 지도에서 마지막으로 본 땅 (기기에 저장하지 않음). 매물 카드 번역하기 문제에 쓴다
  const [lastParcel, setLastParcel] = useState<Parcel | null>(null);
  const [tipsEnabled, setTipsEnabled] = useState(true);
  const [tipsSettingsReady, setTipsSettingsReady] = useState(false);
  const [todayKey, setTodayKey] = useState(kstDateKey());
  const [todayEnabled, setTodayEnabled] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= 768;
  const desktop = Platform.OS === "web" && width >= 1024;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (popup) {
        e.preventDefault();
        setPopup(null);
      } else if (route && route.kind !== "search") {
        e.preventDefault();
        setRoute(
          route.kind === "term" && route.returnTo === "matching"
            ? { kind: "matching" }
            : null,
        );
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [popup, route]);
  // 데이터 API가 쓸 access token. repo를 다시 만들지 않게 ref로 읽는다
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // 로그인 안내 시트(시안 A1). 로그인하지 않고 관심 별·관심 목록을 눌렀거나 세션이 끝났을 때 띄운다
  const [loginAsk, setLoginAsk] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const askLogin = (kind: InterestKind) => {
    if (!auth) {
      notify("지금은 로그인을 쓸 수 없어요");
      return;
    }
    setLoginAsk({
      title: `관심 ${kind === "complex" ? "단지" : "경매"}는 로그인하면 저장돼요`,
      message:
        "로그인하면 관심 단지·경매를 계정에 저장하고, 어느 기기에서든 같은 목록을 볼 수 있어요.",
    });
  };
  // 데이터 API의 갱신이 401로 끝났다(만료·폐기). 로그아웃처럼 세션을 지우되 이미 끝난 세션이라 로그아웃 API는 부르지 않는다
  const expiredRef = useRef(() => {});
  expiredRef.current = () => {
    saveSession(null);
    setRoute((r) =>
      // 알림함·리포트도 계정에 묶여 있어 같이 닫는다
      r?.kind === "interests" ||
      r?.kind === "account" ||
      r?.kind === "notifications" ||
      r?.kind === "notification"
        ? null
        : r,
    );
    setLoginAsk({
      title: "로그인이 끝났어요",
      message: "다시 로그인하면 관심 목록을 이어서 쓸 수 있어요.",
    });
  };
  const repo = useMemo(() => {
    // 실제 서버 인증(웹·앱)일 때만 관심 목록 요청에 토큰을 붙인다
    const clientAuth: ClientAuth | undefined =
      auth?.source === "api"
        ? {
            token: () =>
              sessionRef.current
                ? (auth.accessToken?.() ?? sessionRef.current.access_token)
                : undefined,
            account: () => sessionRef.current?.user.id,
            refresh: (used) =>
              auth.refreshAccess
                ? auth.refreshAccess(used)
                : Promise.reject(
                    new ApiError("다시 로그인해 주세요", "UNAUTHORIZED"),
                  ),
            expired: () => expiredRef.current(),
          }
        : undefined;
    return new Repository(
      mode,
      new ApiClient(API_BASE, id, fetch, clientAuth),
      // 샘플 로그인은 가짜 토큰이라 데이터가 실제여도 관심 목록을 앱 안에 둔다(미리보기)
      auth?.source === "sample" ? "sample" : mode,
    );
  }, [mode, id, auth]);
  // 관심 등록(별 버튼)은 로그인한 계정에 저장한다. 계정이 바뀌면 그 계정의 id를 다시 받는다
  const interests = useInterests(
    repo,
    (m) => notify(m),
    id && session ? session.user.id : null,
    (kind) => askLogin(kind),
  );
  // 이번에 열어 본 리포트 id. 읽음 POST가 끝나기 전에 알림함으로 돌아와도 읽은 것으로 보인다
  const [openedReports, setOpenedReports] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const unread = useUnreadCountState(
    repo,
    id && session ? session.user.id : null,
  );
  useEffect(() => {
    deviceId()
      .then(setId)
      .catch(() =>
        setInitError("기기 정보를 저장할 수 없어요. 다시 시도해 주세요"),
      );
    loadStored<Recent[]>("recent", []).then(setRecent);
    // 저장한 세션은 인증 서버에 확인한 뒤에만 되살린다(src/api/restoreSession)
    // 버전은 저장소 읽기 전에 기록한다. 읽는 사이에 로그인·로그아웃하면 복원 결과를 버린다
    const restoreVersion = sessionVersion.current;
    // 소셜 로그인에서 돌아온 참인지는 지금 읽어 둔다. 로그인 마무리가 곧 주소를 첫 화면으로 바꾼다
    const fromCallback =
      Platform.OS === "web" && window.location.pathname === CALLBACK_PATH;
    const isCurrentSession = () => sessionVersion.current === restoreVersion;
    let unmounted = false;
    let stopRestore: (() => void) | undefined;
    Promise.all([
      loadStored<StoredSession | null>("session", null),
      loadRefreshToken(),
    ]).then(([saved, refreshToken]) => {
      if (!saved || unmounted || !isCurrentSession()) return;
      storedRefresh.current = refreshToken;
      // 소셜 로그인에서 돌아온 참이면 새 로그인이 세션을 정한다. 옛 세션 갱신이 새 토큰·쿠키를 덮지 않게 건너뛴다
      if (fromCallback) return;
      if (!auth) {
        void store("session", null);
        void saveRefreshToken(null);
        return;
      }
      stopRestore = restoreSession({
        auth,
        saved,
        refreshToken,
        isCurrent: isCurrentSession,
        onSession: saveSession,
        onClear: () => {
          void store("session", null);
          void saveRefreshToken(null);
        },
        onGiveUp: () =>
          notify(
            "로그인 상태를 확인하지 못했어요. 연결을 확인하고 다시 열어 주세요",
          ),
      });
    });
    loadStored<"평" | "㎡">("unit", "평").then(setUnit);
    loadStored<"normal" | "satellite">("base", "normal").then(setBase);
    loadStored<boolean>("cad", false).then(setCad);
    loadStored<Place | null>("workplace", null).then(setWorkplace);
    loadStored<boolean>("schools", false).then(setSchools);
    loadStored<boolean>("hospitals", false).then(setHospitals);
    loadStored<boolean>("redevelopments", false).then(setRedevelopments);
    loadStored<boolean>("today_enabled", true).then(setTodayEnabled);
    loadStored<boolean>("tips_enabled", true).then((value) => {
      setTipsEnabled(value);
      setTipsSettingsReady(true);
    });
    loadMatchingRecord()
      .then(setMatchingRecord)
      .catch(() => {});
    return () => {
      clearTimeout(toastTimer.current);
      unmounted = true;
      stopRestore?.();
    };
  }, []);
  useEffect(() => {
    if (!id) return;
    const a = new AbortController();
    setTerms([]);
    setTermsLoading(true);
    setTermsError(null);
    repo
      .glossary(a.signal)
      .then((r) => {
        if (!a.signal.aborted) setTerms(r.data);
      })
      .catch((e) => {
        if (!a.signal.aborted) setTermsError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setTermsLoading(false);
      });
    return () => a.abort();
  }, [repo, id, termsRetry]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (popup) {
        setPopup(null);
        return true;
      }
      if (route) {
        setRoute(
          route.kind === "term" && route.returnTo === "matching"
            ? { kind: "matching" }
            : null,
        );
        return true;
      }
      if (tab !== "map") {
        setTab("map");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [route, tab, popup]);
  const notify = (message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  };
  const onHelp = (name: string) => {
    const term = terms.find((t) => t.term === name);
    if (term) {
      if (Platform.OS === "web") {
        const rect = document.activeElement?.getBoundingClientRect();
        setPopupAnchor(rect ? { x: rect.left, y: rect.bottom } : undefined);
      }
      setPopup(term);
    } else notify("용어 설명을 아직 불러올 수 없어요");
  };
  const setHistory = (list: Recent[]) => {
    setRecent(list);
    void store("recent", list);
  };
  const select = (r: SearchResult) => {
    setHistory(remember(recent, r));
    setFocus({ result: r, nonce: Date.now() });
    setTab("map");
    setRoute(null);
  };
  const openComplex = async (complexId: string) => {
    try {
      const { data } = await repo.complex(complexId);
      setFocus({
        result: {
          type: "complex",
          complex_id: complexId,
          lat: data.lat,
          lng: data.lng,
        },
        nonce: Date.now(),
      });
      setTab("map");
      setRoute(null);
    } catch {
      notify("단지 위치를 불러올 수 없어요");
    }
  };
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setTodayKey(kstDateKey());
      clearTimeout(timer);
      timer = setTimeout(
        refresh,
        86400000 - ((Date.now() + 9 * 3600000) % 86400000) + 10,
      );
    };
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  // 로그인·가입을 마쳤을 때. 글꼴·기기 id 준비 전(아래 early return 전)에도 부를 수 있게 여기서 정의한다.
  // 로그인하면 들어온 화면(탭)으로 돌아간다. 처음 가입했으면 가입 완료 화면을 먼저 보여 준다.
  // 알림함 위 로그인 시트로 로그인했으면 알림함에 그대로 남는다
  const signedIn = (next: Session, joined: boolean) => {
    saveSession(next);
    if (joined) {
      // 알림함에서 시작한 가입이면 가입 완료 뒤에도 알림함으로 돌아간다
      setRoute((r) => ({
        kind: "joined",
        user: next.user,
        fromInbox: r?.kind === "signup" && r.fromInbox,
      }));
      return;
    }
    setRoute((r) => (r?.kind === "notifications" ? r : null));
    notify(`${next.user.nickname}님, 다시 만나 반가워요`);
  };
  // 웹 소셜 로그인에서 돌아왔으면 로그인을 마친다. 처음 온 사람은 가입 화면으로
  useEffect(() => {
    let alive = true;
    auth
      ?.completeSignIn?.()
      .then((r) => {
        if (!alive || !r) return;
        if (r.kind === "session") signedIn(r.session, false);
        else setRoute({ kind: "signup", signup: r });
      })
      .catch((e) => {
        if (!alive) return;
        // 취소했으면 안내 없이 로그인 화면으로(시안 A5)
        setRoute(
          e?.code === "CANCELLED"
            ? { kind: "login" }
            : {
                kind: "login",
                error: e?.message ?? "로그인을 마치지 못했어요",
              },
        );
      });
    return () => {
      alive = false;
    };
  }, []);
  if (initError)
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}
      >
        <StateCard
          error={initError}
          onRetry={() => {
            setInitError(null);
            deviceId()
              .then(setId)
              .catch(() =>
                setInitError(
                  "기기 정보를 저장할 수 없어요. 다시 시도해 주세요",
                ),
              );
          }}
        />
      </SafeAreaView>
    );
  if (!fonts || !id)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: C.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Brand size={112} wordmark />
        <ActivityIndicator style={{ marginTop: 24 }} />
        <LoadingTip
          loading
          context="all"
          clickable={false}
          enabled={tipsSettingsReady && tipsEnabled}
        />
        <T color={C.muted} style={{ marginTop: 12 }}>
          가지가지를 준비하는 중…
        </T>
      </SafeAreaView>
    );
  const learning = matchingStatus(matchingRecord, todayKey);
  let overlay: React.ReactNode = null;
  if (route?.kind === "matching")
    overlay = (
      <MatchingScreen
        terms={terms}
        parcel={lastParcel}
        onClose={() => {
          setRoute(null);
          void loadMatchingRecord()
            .then(setMatchingRecord)
            .catch(() => {});
        }}
        onTerm={(term) =>
          setRoute({ kind: "term", term, map: true, returnTo: "matching" })
        }
        onComplete={() => {
          void loadMatchingRecord()
            .then(setMatchingRecord)
            .catch(() => {});
        }}
      />
    );
  if (route?.kind === "filter")
    overlay = (
      <FilterScreen
        filters={filters}
        onBack={() => setRoute(null)}
        onApply={(f) => {
          setFilters(f);
          setRoute(null);
        }}
      />
    );
  if (route?.kind === "search")
    overlay = desktop ? (
      <WebSearch
        repo={repo}
        recent={recent}
        onRecent={setHistory}
        onSelect={select}
        onClose={() => setRoute(null)}
      />
    ) : (
      <SearchScreen
        repo={repo}
        recent={recent}
        onRecent={setHistory}
        onSelect={select}
        onBack={() => setRoute(null)}
      />
    );
  if (route?.kind === "term")
    overlay = (
      <TermDetail
        term={route.term}
        returnMap={route.map}
        badge={route.badge}
        onBack={() => {
          setRoute(route.returnTo === "matching" ? { kind: "matching" } : null);
          if (route.map) setTab("map");
        }}
      />
    );
  if (route?.kind === "login" && auth)
    overlay = (
      <LoginScreen
        auth={auth}
        onBack={() => setRoute(null)}
        onSession={(next) => signedIn(next, false)}
        onSignup={(signup) => setRoute({ kind: "signup", signup })}
        initialError={route.error}
      />
    );
  if (route?.kind === "joined")
    overlay = (
      <SignupDoneScreen
        user={route.user}
        onDone={() =>
          setRoute(route.fromInbox ? { kind: "notifications" } : null)
        }
      />
    );
  if (route?.kind === "signup" && auth)
    overlay = (
      <SignupScreen
        auth={auth}
        signup={route.signup}
        onBack={() => setRoute({ kind: "login" })}
        onSession={(next) => signedIn(next, true)}
        onExpired={() =>
          setRoute({
            kind: "login",
            error: "가입 시간이 지났어요. 다시 로그인해 주세요",
          })
        }
      />
    );
  if (route?.kind === "account" && auth && session)
    overlay = (
      <AccountScreen
        auth={auth}
        session={session}
        onBack={() => setRoute(null)}
        notify={notify}
        onUser={(user) => {
          // 닉네임을 바꾸는 사이 토큰이 갱신됐을 수 있어 지금 세션에 사용자만 바꿔 넣는다
          setSession((prev) => {
            if (!prev) return prev;
            const next = { ...prev, user };
            void store("session", toStored(next));
            return next;
          });
        }}
        onSignedOut={(withdrawn) => {
          saveSession(null);
          setRoute(null);
          notify(
            withdrawn ? "탈퇴했어요. 그동안 고마웠어요" : "로그아웃했어요",
          );
        }}
      />
    );
  if (route?.kind === "terms")
    overlay = <TermsScreen kind={route.name} onBack={() => setRoute(null)} />;
  if (route?.kind === "date")
    overlay = (
      <DataDateScreen
        onBack={() => setRoute(null)}
        date={
          dataMeta?.data_as_of ?? (mode === "sample" ? "2026-10-05" : undefined)
        }
      />
    );
  if (route?.kind === "workplace")
    overlay = (
      <SearchScreen
        title="직장 찾기"
        placeholder="회사 주소·지하철역 검색"
        // 동네(구·동)는 중심점이라 시간이 틀리게 나온다. 주소·역·단지·학교만 고른다
        types={["address", "station", "complex", "school"]}
        repo={repo}
        onSelect={(r) => {
          const place = placeFromSearch(r);
          setWorkplace(place);
          void store("workplace", place);
          notify(`직장을 정했어요 · ${place.name}`);
          setRoute(route.home ? { kind: "commute", home: route.home } : null);
        }}
        onBack={() =>
          setRoute(
            route.home && workplace
              ? { kind: "commute", home: route.home }
              : null,
          )
        }
      />
    );
  if (route?.kind === "commute")
    overlay = (
      <CommuteScreen
        repo={repo}
        home={route.home}
        onBack={() => setRoute(null)}
      />
    );
  if (route?.kind === "transactions")
    overlay = (
      <TransactionsScreen
        repo={repo}
        filters={filters}
        bbox={route.bbox}
        region={route.region}
        regionName={route.name}
        onBack={() => setRoute(null)}
        onComplex={openComplex}
        unit={unit}
      />
    );
  const showAuction = (a: {
    id: string;
    lat: number | null;
    lng: number | null;
  }) => {
    setAuctionFocus({ id: a.id, lat: a.lat, lng: a.lng, nonce: Date.now() });
    setTab("map");
    setRoute(null);
  };
  if (route?.kind === "interests")
    overlay = (
      <InterestsScreen
        repo={repo}
        initialTab={route.tab}
        unit={unit}
        onBack={() => setRoute(null)}
        onComplex={openComplex}
        onAuction={showAuction}
      />
    );
  if (route?.kind === "notifications")
    overlay = (
      <NotificationsScreen
        repo={repo}
        loggedIn={session !== null}
        readIds={openedReports}
        onBack={() => {
          setRoute(null);
          unread.refresh();
        }}
        onOpen={(nid) => {
          setOpenedReports((s) => new Set(s).add(nid));
          setRoute({ kind: "notification", id: nid });
        }}
        notify={notify}
        // main의 로그인 흐름처럼 알림함 화면 위에 로그인 시트를 띄운다
        onLogin={() => {
          if (!auth) {
            notify("지금은 로그인을 쓸 수 없어요");
            return;
          }
          setLoginAsk({
            title: "알림은 로그인하면 볼 수 있어요",
            message:
              "로그인하면 관심 단지 주간 리포트를 알림함에서 받아 볼 수 있어요.",
          });
        }}
      />
    );
  if (route?.kind === "notification")
    overlay = (
      <ReportScreen
        repo={repo}
        id={route.id}
        onBack={() => setRoute({ kind: "notifications" })}
        onComplex={openComplex}
        onCompare={() => setRoute({ kind: "interests", tab: "complex" })}
        onRead={unread.refresh}
      />
    );
  if (route?.kind === "auctions")
    overlay = (
      <AuctionsScreen
        repo={repo}
        bbox={route.bbox}
        property={filters.property_type}
        complexId={route.complexId}
        name={route.name}
        unit={unit}
        onBack={() => setRoute(null)}
        onAuction={showAuction}
      />
    );
  return (
    <InterestsProvider value={interests}>
      <LearningProvider
        value={{
          terms,
          tipsEnabled,
          onTerm: (term) => setRoute({ kind: "term", term, map: true }),
        }}
      >
        <CommuteProvider
          value={
            transitEnabled
              ? {
                  workplace,
                  pickWorkplace: (home) =>
                    setRoute({ kind: "workplace", home }),
                  clearWorkplace: () => {
                    setWorkplace(null);
                    void store("workplace", null);
                    setRoute(null);
                    notify("직장을 지웠어요");
                  },
                  openRoute: (home) => setRoute({ kind: "commute", home }),
                }
              : null
          }
        >
          <SafeAreaView
            style={{ flex: 1, backgroundColor: width > 600 ? "#EAEAE5" : C.bg }}
          >
            <StatusBar barStyle="dark-content" />
            <View
              style={{
                flex: 1,
                width: "100%",
                maxWidth: wide ? undefined : 420,
                alignSelf: "center",
                backgroundColor: C.bg,
                position: "relative",
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 0 40px rgba(17,17,16,.08)" }
                  : {}),
              }}
            >
              <View style={{ flex: 1, position: "relative" }}>
                <View
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: tab === "map" ? 1 : 0,
                    pointerEvents: tab === "map" ? "auto" : "none",
                  }}
                >
                  <MapHome
                    key={mode}
                    repo={repo}
                    filters={filters}
                    onFilters={setFilters}
                    onSearch={() => setRoute({ kind: "search" })}
                    onGlossary={() => setTab("glossary")}
                    interactionBlocked={!!popup || !!route || tab !== "map"}
                    onFilter={() => setRoute({ kind: "filter" })}
                    onList={(args) =>
                      setRoute({ kind: "transactions", ...args })
                    }
                    onDate={() => setRoute({ kind: "date" })}
                    unit={unit}
                    onUnit={(u) => {
                      setUnit(u);
                      void store("unit", u);
                    }}
                    base={base}
                    onBase={(b) => {
                      setBase(b);
                      void store("base", b);
                    }}
                    cadastral={cad}
                    onCadastral={(c) => {
                      setCad(c);
                      void store("cad", c);
                    }}
                    schools={schools}
                    onSchools={(on) => {
                      setSchools(on);
                      void store("schools", on);
                    }}
                    hospitals={hospitals}
                    onHospitals={(on) => {
                      setHospitals(on);
                      void store("hospitals", on);
                    }}
                    redevelopments={redevelopments}
                    onRedevelopments={(on) => {
                      setRedevelopments(on);
                      void store("redevelopments", on);
                    }}
                    focus={focus}
                    focusAuction={auctionFocus}
                    onHelp={onHelp}
                    notify={notify}
                    onMeta={setDataMeta}
                    onParcel={setLastParcel}
                    onToday={() => setRoute({ kind: "matching" })}
                    auction={auction}
                    onAuction={setAuction}
                    onAuctionList={(args) =>
                      setRoute({ kind: "auctions", ...args })
                    }
                  />
                </View>
                {tab === "glossary" && (
                  <GlossaryScreen
                    terms={terms}
                    loading={termsLoading}
                    error={termsError}
                    onRetry={() => setTermsRetry((x) => x + 1)}
                    onTerm={(term) =>
                      setRoute({ kind: "term", term, map: false })
                    }
                    today={todayEnabled ? learning : undefined}
                    onToday={() => setRoute({ kind: "matching" })}
                  />
                )}
                {tab === "more" && (
                  <MoreScreen
                    user={session?.user ?? null}
                    onLogin={
                      auth ? () => setRoute({ kind: "login" }) : undefined
                    }
                    onAccount={() => setRoute({ kind: "account" })}
                    onInterests={(kind) =>
                      session
                        ? setRoute({ kind: "interests", tab: kind })
                        : askLogin(kind)
                    }
                    interestCount={interests.count}
                    onNotifications={() => setRoute({ kind: "notifications" })}
                    unreadCount={unread.count}
                    mode={mode}
                    date={
                      dataMeta?.data_as_of ??
                      (mode === "sample" ? "2026-10-05" : undefined)
                    }
                    onMode={(m) => {
                      setFocus(undefined);
                      setAuctionFocus(null);
                      setDataMeta(undefined);
                      setMode(m);
                      notify(
                        m === "sample"
                          ? "샘플 데이터로 화면을 보여드려요"
                          : "백엔드 API에 연결합니다",
                      );
                    }}
                    onDate={() => setRoute({ kind: "date" })}
                    onTerms={(name) => setRoute({ kind: "terms", name })}
                    notify={notify}
                    tipsEnabled={tipsEnabled}
                    onTipsEnabled={(on) => {
                      setTipsEnabled(on);
                      void store("tips_enabled", on);
                    }}
                    todayEnabled={todayEnabled}
                    onTodayEnabled={(on) => {
                      setTodayEnabled(on);
                      void store("today_enabled", on);
                    }}
                  />
                )}
              </View>
              <View
                style={{
                  height: 54,
                  flexDirection: "row",
                  borderTopWidth: 1,
                  borderColor: C.rule,
                  backgroundColor: C.surface,
                  zIndex: 40,
                }}
              >
                {(
                  [
                    ["map", "지도", "map"],
                    ["glossary", "용어사전", "book"],
                    ["more", "더보기", "more"],
                  ] as const
                ).map(([k, label, icon]) => (
                  <Pressable
                    key={k}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === k }}
                    onPress={() => {
                      setTab(k);
                      setRoute(null);
                    }}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                    }}
                  >
                    <Icon name={icon} color={tab === k ? C.ink : C.light} />
                    <T
                      size={14}
                      bold={tab === k}
                      color={tab === k ? C.ink : C.light}
                    >
                      {label}
                    </T>
                  </Pressable>
                ))}
              </View>
              {overlay && (
                <View
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: wide ? "rgba(17,17,16,.24)" : C.bg,
                    zIndex: 50,
                    alignItems: wide ? "center" : undefined,
                    justifyContent: wide ? "center" : undefined,
                  }}
                >
                  {wide && (
                    <Pressable
                      accessibilityLabel="화면 닫기"
                      onPress={() => setRoute(null)}
                      style={{ position: "absolute", inset: 0 }}
                    />
                  )}
                  <View
                    style={
                      wide
                        ? {
                            width:
                              route?.kind === "search" && desktop ? 520 : 560,
                            maxWidth: "95%",
                            height:
                              route?.kind === "search" && desktop
                                ? undefined
                                : "92%",
                            maxHeight: "92%",
                            backgroundColor: C.bg,
                            borderRadius: 14,
                            overflow: "hidden",
                            ...(route?.kind === "search" && desktop
                              ? { position: "absolute", left: 190, top: 72 }
                              : {}),
                          }
                        : { flex: 1 }
                    }
                  >
                    {overlay}
                  </View>
                </View>
              )}
              {toast !== "" && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 18,
                    right: 18,
                    bottom: route ? 24 : 82,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: C.primary,
                    zIndex: 100,
                  }}
                >
                  <T color={C.bg} style={{ textAlign: "center" }}>
                    {toast}
                  </T>
                </View>
              )}
              {loginAsk && auth && (
                <View style={{ position: "absolute", inset: 0, zIndex: 60 }}>
                  <LoginSheet
                    auth={auth}
                    title={loginAsk.title}
                    message={loginAsk.message}
                    onClose={() => setLoginAsk(null)}
                    onSession={(next) => {
                      setLoginAsk(null);
                      signedIn(next, false);
                    }}
                    onSignup={(signup) => {
                      setLoginAsk(null);
                      // 알림함 위 로그인 시트에서 넘어왔으면 표시해 둔다
                      setRoute((r) => ({
                        kind: "signup",
                        signup,
                        fromInbox: r?.kind === "notifications",
                      }));
                    }}
                  />
                </View>
              )}
              <TermPopup
                term={popup}
                anchor={popupAnchor}
                onClose={() => setPopup(null)}
                onDetail={(term) => {
                  setPopup(null);
                  setRoute({ kind: "term", term, map: tab === "map" });
                }}
              />
            </View>
          </SafeAreaView>
        </CommuteProvider>
      </LearningProvider>
    </InterestsProvider>
  );
}
