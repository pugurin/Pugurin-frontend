import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import type { BBox, Filters, SearchResult, Term, Meta } from "./src/api/types";
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
import { MapHome, type Focus } from "./src/screens/MapHome";
import { FilterScreen } from "./src/screens/FilterScreen";
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
import { LoadingTip } from "./src/components/LoadingTip";
import { GlossaryContext } from "./src/glossary/context";
import { kstDateKey, pickToday, todayLabel } from "./src/glossary/today";
type Route =
  | { kind: "filter" }
  | { kind: "search" }
  | { kind: "term"; term: Term; map: boolean; badge?: string }
  | { kind: "terms"; name: TermKind }
  | { kind: "date" }
  | { kind: "transactions"; bbox: BBox; region?: string; name?: string };
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
  const [unit, setUnit] = useState<"평" | "㎡">("평");
  const [base, setBase] = useState<"normal" | "satellite">("normal");
  const [cad, setCad] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [focus, setFocus] = useState<Focus>();
  const [terms, setTerms] = useState<Term[]>([]);
  const [termsLoading, setTermsLoading] = useState(true);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termsRetry, setTermsRetry] = useState(0);
  const [popup, setPopup] = useState<Term | null>(null);
  const [toast, setToast] = useState("");
  // 오늘의 용어: 더보기에서 끄기(계속), ✕로 닫은 날(그날만). 둘 다 기기에 저장
  const [todayEnabled, setTodayEnabled] = useState(true);
  const [todayClosedOn, setTodayClosedOn] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const { width } = useWindowDimensions();
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
    loadStored<"평" | "㎡">("unit", "평").then(setUnit);
    loadStored<"normal" | "satellite">("base", "normal").then(setBase);
    loadStored<boolean>("cad", false).then(setCad);
    loadStored<boolean>("today_enabled", true).then(setTodayEnabled);
    loadStored<string>("today_closed_on", "").then(setTodayClosedOn);
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
        setRoute(null);
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
    if (term) setPopup(term);
    else notify("용어 설명을 아직 불러올 수 없어요");
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
  const todayKey = kstDateKey();
  const todayTerm =
    todayEnabled && todayClosedOn !== todayKey
      ? pickToday(terms, todayKey)
      : null;
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
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator />
          <T color={C.muted} style={{ marginTop: 12 }}>
            퍼그린을 준비하는 중…
          </T>
        </View>
        {/* T01: 처음 열 때 1초 넘게 걸리면 기본 용어에서 팁. 누를 수 없다 */}
        <View style={{ alignSelf: "stretch", padding: 20, paddingBottom: 28 }}>
          <LoadingTip context="splash" terms={[]} linked={false} />
        </View>
      </SafeAreaView>
    );
  let overlay: React.ReactNode = null;
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
    overlay = (
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
          setRoute(null);
          if (route.map) setTab("map");
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
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: width > 600 ? "#EAEAE5" : C.bg }}
    >
      <StatusBar barStyle="dark-content" />
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 420,
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
            {/* 시트 로딩 팁이 용어 목록을 쓰고 용어 상세를 연다 */}
            <GlossaryContext.Provider
              value={{
                terms,
                openTerm: (term) => setRoute({ kind: "term", term, map: true }),
              }}
            >
              <MapHome
                key={mode}
                repo={repo}
                filters={filters}
                onFilters={setFilters}
                onSearch={() => setRoute({ kind: "search" })}
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
                focus={focus}
                onHelp={onHelp}
                notify={notify}
                onMeta={setDataMeta}
                todayTerm={todayTerm}
                onTodayOpen={(term) =>
                  setRoute({
                    kind: "term",
                    term,
                    map: true,
                    badge: `오늘의 용어 · ${todayLabel(todayKey)}`,
                  })
                }
                onTodayClose={() => {
                  setTodayClosedOn(todayKey);
                  void store("today_closed_on", todayKey);
                  notify("오늘은 더 보이지 않아요\n더보기에서 끌 수 있어요");
                }}
              />
            </GlossaryContext.Provider>
          </View>
          {tab === "glossary" && (
            <GlossaryScreen
              terms={terms}
              loading={termsLoading}
              error={termsError}
              onRetry={() => setTermsRetry((x) => x + 1)}
              onTerm={(term) => setRoute({ kind: "term", term, map: false })}
            />
          )}
          {tab === "more" && (
            <MoreScreen
              mode={mode}
              date={
                dataMeta?.data_as_of ??
                (mode === "sample" ? "2026-10-05" : undefined)
              }
              onMode={(m) => {
                setFocus(undefined);
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
              <T size={14} bold={tab === k} color={tab === k ? C.ink : C.light}>
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
              backgroundColor: C.bg,
              zIndex: 50,
            }}
          >
            {overlay}
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
          onClose={() => setPopup(null)}
          onDetail={(term) => {
            setPopup(null);
            setRoute({ kind: "term", term, map: tab === "map" });
          }}
        />
      </View>
    </SafeAreaView>
  );
}
