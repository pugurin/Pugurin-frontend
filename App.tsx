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
import { ApiClient } from "./src/api/client";
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
} from "./src/api/auth";
import { ApiError } from "./src/api/client";
import { AccountScreen, LoginScreen, SignupScreen } from "./src/screens/AuthScreens";
import { SampleInterests } from "./src/api/interests";
import { InterestsProvider, useInterestsState } from "./src/state/interests";
import { InterestsScreen } from "./src/screens/InterestsScreen";
type Route =
  | { kind: "login" }
  // 처음 로그인한 사람의 가입 마무리
  | { kind: "signup"; signup: Extract<SignInResult, { kind: "signup" }> }
  | { kind: "account" }
  | { kind: "interests" }
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
  | { kind: "transactions"; bbox: BBox; region?: string; name?: string }
  // 경매 목록. 단지 묶음 마커에서 열면 그 단지로 거른다
  | { kind: "auctions"; bbox: BBox; complexId?: string; name?: string };
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
  // 로그인 세션. 기기에 저장해 다음에 열어도 로그인이 유지된다(F-AUTH-02).
  // 백엔드 인증 API 전이라 EXPO_PUBLIC_AUTH_MODE=sample일 때만 앱 안 가짜 서버(SampleAuth)를 켠다.
  // 운영 빌드에는 이 값이 없어 로그인 카드가 "준비 중"으로 남는다
  const [session, setSession] = useState<Session | null>(null);
  const auth = useMemo<AuthApi | null>(
    () => (process.env.EXPO_PUBLIC_AUTH_MODE === "sample" ? new SampleAuth() : null),
    [],
  );
  const saveSession = (next: Session | null) => {
    setSession(next);
    void store("session", next && toStored(next, Platform.OS === "web"));
  };
  // 관심 단지·지역(F-INT-01·02). 백엔드 API 전이라 앱 안 가짜 서버를 쓴다
  const interestsApi = useMemo(() => new SampleInterests(), []);
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
  const repo = useMemo(
    () =>
      new Repository(
        mode,
        new ApiClient(
          apiBase(
            process.env.EXPO_PUBLIC_API_URL ||
              process.env.EXPO_PUBLIC_API_BASE ||
              (Platform.OS === "web"
                ? "http://localhost:8001/api/v1"
                : Platform.OS === "android"
                  ? "http://10.0.2.2:8000/api/v1"
                  : "http://localhost:8000/api/v1"),
          ),
          id,
        ),
      ),
    [mode, id],
  );
  useEffect(() => {
    deviceId()
      .then(setId)
      .catch(() =>
        setInitError("기기 정보를 저장할 수 없어요. 다시 시도해 주세요"),
      );
    loadStored<Recent[]>("recent", []).then(setRecent);
    // 저장한 세션은 인증 서버에 확인한 뒤에만 되살린다. 출처가 다르거나 계정이 없으면 지운다
    loadStored<StoredSession | null>("session", null).then((saved) => {
      if (!saved) return;
      if (!auth) return void store("session", null);
      auth
        .restore(saved)
        .then(saveSession)
        .catch((e) => {
          if (e instanceof ApiError && e.code === "UNAUTHORIZED")
            void store("session", null);
        });
    });
    loadStored<"평" | "㎡">("unit", "평").then(setUnit);
    loadStored<"normal" | "satellite">("base", "normal").then(setBase);
    loadStored<boolean>("cad", false).then(setCad);
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
    return () => clearTimeout(toastTimer.current);
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
  // 로그인을 아직 열지 않은 빌드(auth 없음)에서는 빈 화면 대신 준비 중이라고 알린다
  const askLogin = () => {
    if (auth) return setRoute({ kind: "login" });
    notify("로그인과 관심 기능은 다음 단계에서 준비하고 있어요");
  };
  const interests = useInterestsState(interestsApi, session, notify, askLogin);
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
  const signedIn = (next: Session, joined: boolean) => {
    saveSession(next);
    setRoute(null);
    setTab("more");
    notify(
      joined
        ? `가입을 마쳤어요. 반가워요, ${next.user.nickname}님`
        : `${next.user.nickname}님, 다시 만나 반가워요`,
    );
  };
  if (route?.kind === "login" && auth)
    overlay = (
      <LoginScreen
        auth={auth}
        onBack={() => setRoute(null)}
        onSession={(next) => signedIn(next, false)}
        onSignup={(signup) => setRoute({ kind: "signup", signup })}
      />
    );
  if (route?.kind === "signup" && auth)
    overlay = (
      <SignupScreen
        auth={auth}
        signup={route.signup}
        onBack={() => setRoute({ kind: "login" })}
        onSession={(next) => signedIn(next, true)}
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
          saveSession({ ...session, user });
        }}
        onSignedOut={(withdrawn) => {
          // 탈퇴하면 관심 목록도 계정과 함께 지운다
          if (withdrawn) void interestsApi.clear(session).catch(() => {});
          saveSession(null);
          setRoute(null);
          notify(
            withdrawn ? "탈퇴했어요. 그동안 고마웠어요" : "로그아웃했어요",
          );
        }}
      />
    );
  if (route?.kind === "interests" && session)
    overlay = (
      <InterestsScreen
        unit={unit}
        onBack={() => setRoute(null)}
        onComplex={(id) => void openComplex(id)}
        onRegion={(r) => {
          // 검색 기록에는 남기지 않고 그 동으로 지도만 옮긴다
          setFocus({
            result: {
              type: "region",
              name: r.name,
              region_code: r.region_code,
              region_level: "dong",
              lat: r.lat,
              lng: r.lng,
            },
            nonce: Date.now(),
          });
          setTab("map");
          setRoute(null);
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
        onAuction={(a) => {
          setAuctionFocus({
            id: a.id,
            lat: a.lat,
            lng: a.lng,
            nonce: Date.now(),
          });
          setTab("map");
          setRoute(null);
        }}
      />
    );
  return (
    <LearningProvider
      value={{
        terms,
        tipsEnabled,
        onTerm: (term) => setRoute({ kind: "term", term, map: true }),
      }}
    >
      <InterestsProvider value={interests}>
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
                  onList={(args) => setRoute({ kind: "transactions", ...args })}
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
                  onLogin={auth ? () => setRoute({ kind: "login" }) : undefined}
                  onAccount={() => setRoute({ kind: "account" })}
                  onInterests={() => {
                    if (session) return setRoute({ kind: "interests" });
                    if (!auth) return askLogin();
                    notify("로그인하면 관심 목록을 볼 수 있어요");
                    setRoute({ kind: "login" });
                  }}
                  interestCount={
                    interests.complexes.length + interests.regions.length
                  }
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
      </InterestsProvider>
    </LearningProvider>
  );
}
