import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";
import * as Location from "expo-location";
import {
  initialLocationStart,
  markLocationAsked,
} from "../state/location";
import { LocationAsk } from "../components/LocationAsk";
import type { UserLocation } from "../map/userLocation";
import type { Repository } from "../api/repository";
import type {
  BBox,
  Filters,
  Marker,
  Meta,
  Parcel,
  RegionMarker,
  SearchResult,
  Term,
} from "../api/types";
import {
  changeDeal,
  changeProperty,
  DEFAULT_FILTERS,
  DEAL,
  HOME,
  busanQueryBBox,
  markerId,
  MAX_PERIOD_MONTHS,
  PERIOD_OPTIONS,
  nextPeriod,
  PROPERTY,
} from "../state/market";
import { C } from "../theme/tokens";
import { Brand } from "../components/Brand";
import { TodayTermCard } from "../components/TodayTermCard";
import {
  AdSlot,
  Btn,
  Chip,
  Icon,
  IconBtn,
  Notice,
  StateCard,
  T,
  s,
} from "../components/ui";
import { Sheet, type SheetStage } from "../components/Sheet";
import MapCanvas from "../map/MapCanvas";
import type { Camera, MapCommand, MapEvent } from "../map/types";
import { ComplexContent, RegionContent } from "./MarketSheets";
import { LandContent } from "./LandContent";
export type Focus = { result: SearchResult; nonce: number };
export function MapHome({
  repo,
  filters,
  onFilters,
  onSearch,
  onGlossary,
  interactionBlocked = false,
  onFilter,
  onList,
  onDate,
  unit,
  onUnit,
  base,
  onBase,
  cadastral,
  onCadastral,
  focus,
  onHelp,
  notify,
  onMeta,
  todayTerm,
  onTodayOpen,
  onTodayClose,
  todayStreak = 0,
  todayCompleted = false,
  onParcel,
}: {
  repo: Repository;
  filters: Filters;
  onFilters: (f: Filters) => void;
  onSearch: () => void;
  onGlossary?: () => void;
  interactionBlocked?: boolean;
  onFilter: () => void;
  onList: (args: { bbox: BBox; region?: string; name?: string }) => void;
  onDate: () => void;
  unit: "평" | "㎡";
  onUnit: (u: "평" | "㎡") => void;
  base: "normal" | "satellite";
  onBase: (b: "normal" | "satellite") => void;
  cadastral: boolean;
  onCadastral: (c: boolean) => void;
  focus?: Focus;
  onHelp: (name: string) => void;
  notify: (s: string) => void;
  onMeta: (m: Meta) => void;
  // 오늘의 용어 (D01). null이면 카드를 보여주지 않는다(꺼짐·오늘 닫음·용어 없음)
  todayTerm?: Term | null;
  todayStreak?: number;
  todayCompleted?: boolean;
  onTodayOpen?: (term: Term) => void;
  onTodayClose?: () => void;
  // 땅 정보를 받아 오면 알린다. 오늘의 용어 '매물 카드 번역하기'에 쓴다
  onParcel?: (parcel: Parcel) => void;
}) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 1024;
  const [hover, setHover] = useState<{
    marker: Marker;
    point: { x: number; y: number };
  } | null>(null);
  const panelWidth = width >= 1280 ? 400 : 360;
  const [panelDismissed, setPanelDismissed] = useState(false);
  const [camera, setCamera] = useState<Camera>(HOME);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [meta, setMeta] = useState<Meta>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapRetry, setMapRetry] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [layers, setLayers] = useState(false);
  const [period, setPeriod] = useState(false);
  const [selected, setSelected] = useState<
    | { kind: "complex"; id: string }
    | { kind: "region"; marker: RegionMarker }
    | {
        kind: "land";
        lat: number;
        lng: number;
        bbox: BBox;
        region?: { code: string; name: string };
        parcel: Parcel | null;
        loading: boolean;
        error?: string;
      }
    | null
  >(null);
  const [stage, setStage] = useState<SheetStage>("peek");
  const [command, setCommand] = useState<MapCommand & { nonce: number }>();
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [askLocation, setAskLocation] = useState(false);
  const ref = useRef(0);
  const lastFilters = useRef(filters);
  // 검색으로 고른 단지에 맞춰 유형 탭을 바꿀 때는 필터가 바뀌어도 단지 패널을 닫지 않는다
  const keepSelection = useRef(false);
  const queryBBox = busanQueryBBox(camera.bbox);
  const outside = !queryBBox;
  const isLand = filters.property_type === "land";
  const move = (c: MapCommand) => setCommand({ ...c, nonce: ++ref.current });
  const landRequest = useRef<AbortController | null>(null);
  const pendingLand = useRef<{
    lat: number;
    lng: number;
    region?: { code: string; name: string };
    pnu?: string;
  } | null>(null);
  const close = () => {
    pendingLand.current = null;
    landRequest.current?.abort();
    setSelected(null);
    setPanelDismissed(true);
  };
  useEffect(() => () => landRequest.current?.abort(), []);
  useEffect(() => {
    if (!desktop) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !interactionBlocked && !layers && !period)
        close();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [desktop, interactionBlocked, layers, period]);
  useEffect(() => {
    const controller = new AbortController();
    const changed = lastFilters.current !== filters;
    lastFilters.current = filters;
    if (changed) {
      setMarkers([]);
      if (keepSelection.current) keepSelection.current = false;
      else close();
      setPanelDismissed(false);
    }
    if (outside) {
      setLoading(false);
      setMarkers([]);
      setError(null);
      return () => controller.abort();
    }
    setError(null);
    const loadingTimer = setTimeout(() => setLoading(true), 250);
    const timer = setTimeout(
      () =>
        repo
          .markers(
            filters,
            queryBBox!,
            Math.floor(camera.zoom),
            controller.signal,
          )
          .then((r) => {
            if (!controller.signal.aborted) {
              setMarkers(r.data.markers);
              setMeta(r.meta);
              if (r.meta) onMeta(r.meta);
            }
          })
          .catch((e) => {
            if (!controller.signal.aborted) {
              setError(
                e.retryAfter
                  ? `${e.message} (${e.retryAfter}초 후)`
                  : e.message,
              );
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) {
              clearTimeout(loadingTimer);
              setLoading(false);
            }
          }),
      changed ? 0 : 220,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
      clearTimeout(loadingTimer);
    };
  }, [repo, filters, camera, outside, retry]);
  useEffect(() => {
    if (!focus) return;
    close();
    const r = focus.result;
    if (r.type === "complex" && r.complex_id) {
      setSelected({ kind: "complex", id: r.complex_id });
      setStage("peek");
      move({ type: "move", lat: r.lat, lng: r.lng, zoom: 15 });
      // 검색 결과에는 유형이 없어 단지 정보로 확인한다. 다른 유형이면 탭을
      // 그 유형으로 바꿔야 지도에 그 단지 마커가 보인다
      const controller = new AbortController();
      repo
        .complex(r.complex_id, controller.signal)
        .then(({ data }) => {
          if (
            controller.signal.aborted ||
            data.property_type === filters.property_type
          )
            return;
          keepSelection.current = true;
          onFilters(changeProperty(filters, data.property_type));
          notify(`${PROPERTY[data.property_type]} 탭으로 바꿨어요`);
        })
        .catch(() => {});
      return () => controller.abort();
    } else if (r.type === "region") {
      close();
      if (isLand && r.region_code) {
        setSelected({
          kind: "land",
          lat: r.lat,
          lng: r.lng,
          bbox: r.bbox ?? camera.bbox,
          region: {
            code: r.region_code,
            name: r.name ?? r.address ?? "선택한 지역",
          },
          parcel: null,
          loading: false,
        });
        setStage("half");
      }
      move({
        type: "move",
        bbox: r.bbox,
        lat: r.lat,
        lng: r.lng,
        zoom: r.region_level === "sigungu" ? 12 : 14,
      });
    } else {
      if (isLand)
        pendingLand.current = {
          lat: r.lat,
          lng: r.lng,
          region: r.region_code
            ? {
                code: r.region_code,
                name: r.name ?? r.address ?? "선택한 지역",
              }
            : undefined,
          pnu: r.pnu,
        };
      move({ type: "move", lat: r.lat, lng: r.lng, zoom: 15 });
    }
  }, [focus]);
  // 공급처가 없으면 동 단위 토지 거래(A), 필지를 받으면 필지 상세(B)를 연다.
  const landLookup = (
    lat: number,
    lng: number,
    region?: { code: string; name: string },
    destinationBBox?: BBox,
    pnu?: string,
  ) => {
    pendingLand.current = null;
    landRequest.current?.abort();
    const controller = new AbortController();
    landRequest.current = controller;
    const selection = {
      kind: "land" as const,
      lat,
      lng,
      bbox: destinationBBox ?? queryBBox ?? camera.bbox,
      region,
      parcel: null,
      loading: true,
    };
    setSelected(selection);
    setStage("half");
    // PNU를 알면(주소 검색·필지 마커) 좌표 대신 PNU로 조회한다
    (pnu
      ? repo.parcel(pnu, controller.signal)
      : repo.parcelLookup(lat, lng, controller.signal)
    )
      .then((r) => {
        if (controller.signal.aborted) return;
        const reason = r.meta?.unavailable_reason;
        if (reason === "no_parcel" || reason === "out_of_service_area") {
          setSelected(null);
          notify(
            reason === "no_parcel"
              ? "이곳은 토지 정보가 없어요"
              : "부산 지역만 지원해요",
          );
          return;
        }
        setSelected({ ...selection, parcel: r.data, loading: false });
        if (r.data) onParcel?.(r.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setSelected({
            ...selection,
            loading: false,
            error: e.message ?? "토지 정보를 잠시 불러올 수 없어요",
          });
      });
  };
  const markerPress = (m: Marker) => {
    pendingLand.current = null;
    landRequest.current?.abort();
    if (m.kind === "region") {
      landRequest.current?.abort();
      setSelected(
        isLand
          ? {
              kind: "land",
              lat: m.lat,
              lng: m.lng,
              bbox: queryBBox ?? camera.bbox,
              region: { code: m.region_code, name: m.name },
              parcel: null,
              loading: false,
            }
          : { kind: "region", marker: m },
      );
      setStage("half");
      move({
        type: "move",
        lat: m.lat,
        lng: m.lng,
        zoom: Math.max(camera.zoom, m.region_code.length === 5 ? 12 : 14),
      });
    } else if (m.kind === "complex") {
      setSelected({ kind: "complex", id: m.complex_id });
      setStage("peek");
    } else landLookup(m.lat, m.lng, undefined, undefined, m.pnu);
  };
  const onEvent = (e: MapEvent) => {
    if (e.type === "camera") {
      if (e.bbox.every(Number.isFinite)) {
        setCamera({ lat: e.lat, lng: e.lng, zoom: e.zoom, bbox: e.bbox });
        const pending = pendingLand.current;
        if (
          pending &&
          Math.abs(e.lat - pending.lat) < 0.0005 &&
          Math.abs(e.lng - pending.lng) < 0.0005
        ) {
          pendingLand.current = null;
          landLookup(
            pending.lat,
            pending.lng,
            pending.region,
            busanQueryBBox(e.bbox) ?? e.bbox,
            pending.pnu,
          );
        }
      }
    }
    if (e.type === "marker") {
      const m = markers.find((m) => markerId(m) === e.id);
      if (m) markerPress(m);
    }
    if (e.type === "mapClick") {
      if (!isLand) close();
      else if (camera.zoom < 14)
        notify("조금 더 확대하면 땅을 하나씩 골라 볼 수 있어요");
      else landLookup(e.lat, e.lng);
    }
    if (e.type === "error") setMapError(e.message);
  };
  const panelVisible = desktop && (!!selected || !panelDismissed);
  useEffect(() => {
    if (!desktop || selected || panelDismissed || pendingLand.current) return;
    const region = markers
      .filter((marker): marker is RegionMarker => marker.kind === "region")
      .sort((a, b) => b.transaction_count - a.transaction_count)[0];
    if (!region) return;
    setSelected(
      isLand
        ? {
            kind: "land",
            lat: region.lat,
            lng: region.lng,
            bbox: queryBBox ?? camera.bbox,
            region: { code: region.region_code, name: region.name },
            parcel: null,
            loading: false,
          }
        : { kind: "region", marker: region },
    );
    setStage("full");
  }, [desktop, markers, selected, panelDismissed, isLand]);
  // quiet: 앱 시작 때 자동으로 부를 때는 실패해도 알리지 않는다
  const locate = async (quiet = false) => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        if (!quiet)
          notify("위치 권한이 꺼져 있어요. 휴대폰 설정에서 켤 수 있어요");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      move({
        type: "move",
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        zoom: 15,
      });
    } catch {
      if (!quiet)
        notify("현재 위치를 확인할 수 없어요. 위치 설정을 확인해 주세요");
    } finally {
      setLocating(false);
    }
  };
  // 첫 실행이면 위치 안내 모달, 이미 허용했으면 바로 내 위치에서 시작한다(#92)
  useEffect(() => {
    let alive = true;
    void initialLocationStart().then((start) => {
      if (!alive) return;
      if (start === "locate") void locate(true);
      else if (start === "ask") setAskLocation(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const answerLocation = (allow: boolean) => {
    setAskLocation(false);
    void markLocationAsked();
    if (allow) void locate();
  };
  const detailSheet = selected ? (
    <Sheet
      key={
        selected.kind === "complex"
          ? `complex:${selected.id}`
          : selected.kind === "land"
            ? `land:${selected.lat},${selected.lng}`
            : `region:${selected.marker.region_code}`
      }
      stage={desktop ? "full" : stage}
      onStage={desktop ? () => {} : setStage}
      onClose={close}
      docked={desktop}
      panelWidth={panelWidth}
    >
      {selected.kind === "land" ? (
        <LandContent
          repo={repo}
          filters={filters}
          bbox={selected.bbox}
          region={selected.region}
          parcel={selected.parcel}
          loading={selected.loading}
          error={selected.error}
          onRetry={() =>
            landLookup(
              selected.lat,
              selected.lng,
              selected.region,
              selected.bbox,
            )
          }
          onList={() =>
            onList({
              bbox: selected.bbox,
              region: selected.region?.code,
              name: selected.region?.name,
            })
          }
          onHelp={onHelp}
          unit={unit}
        />
      ) : selected.kind === "complex" ? (
        <ComplexContent
          key={selected.id}
          id={selected.id}
          repo={repo}
          filters={filters}
          stage={desktop ? "full" : stage}
          onStage={setStage}
          onHelp={onHelp}
          notify={notify}
          unit={unit}
          onUnit={onUnit}
        />
      ) : (
        <>
          {desktop && todayTerm && (
            <View style={{ marginBottom: 16 }}>
              <TodayTermCard
                term={todayTerm}
                streak={todayStreak}
                completed={todayCompleted}
                onOpen={() => onTodayOpen?.(todayTerm)}
                onClose={() => onTodayClose?.()}
              />
            </View>
          )}
          <RegionContent
            marker={selected.marker}
            filters={filters}
            repo={repo}
            onList={() =>
              onList({
                bbox: camera.bbox,
                region: selected.marker.region_code,
                name: selected.marker.name,
              })
            }
            onComplex={(id) => {
              setSelected({ kind: "complex", id });
              setStage("peek");
            }}
            onHelp={onHelp}
            date={meta?.data_as_of}
            unit={unit}
            onUnit={onUnit}
          />
        </>
      )}
    </Sheet>
  ) : null;
  return (
    <View style={s.screen}>
      {desktop ? (
        <View
          style={[
            s.row,
            {
              paddingHorizontal: 18,
              paddingVertical: 12,
              backgroundColor: C.surface,
              borderBottomWidth: 1,
              borderColor: C.rule,
              gap: 12,
              flexWrap: "nowrap",
            },
          ]}
        >
          <Brand size={34} wordmark />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="단지·주소·동네 검색"
            onPress={onSearch}
            style={[
              s.row,
              {
                flex: 1,
                minWidth: 180,
                maxWidth: 360,
                height: 44,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: C.greenRule,
                borderRadius: 10,
                backgroundColor: C.bg,
              },
            ]}
          >
            <Icon name="search" color={C.light} />
            <T size={15} color={C.muted}>
              단지·주소·동네 검색
            </T>
          </Pressable>
          <View
            style={[
              s.row,
              { gap: 3, backgroundColor: C.bg2, padding: 3, borderRadius: 10 },
            ]}
          >
            {(Object.keys(PROPERTY) as (keyof typeof PROPERTY)[]).map((key) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: filters.property_type === key }}
                onPress={() => onFilters(changeProperty(filters, key))}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 9,
                  borderRadius: 8,
                  backgroundColor:
                    filters.property_type === key ? C[key] : "transparent",
                }}
              >
                <T
                  size={14}
                  bold={filters.property_type === key}
                  color={filters.property_type === key ? "#fff" : C.ink}
                >
                  {PROPERTY[key]}
                </T>
              </Pressable>
            ))}
          </View>
          <View style={[s.row, { gap: 5 }]}>
            {width >= 1280 &&
              (Object.keys(DEAL) as (keyof typeof DEAL)[]).map((key) => (
                <Chip
                  key={key}
                  selected={filters.deal_type === key}
                  disabled={isLand && key !== "sale"}
                  onPress={() => onFilters(changeDeal(filters, key))}
                >
                  {DEAL[key]}
                </Chip>
              ))}
            <Chip onPress={() => setPeriod(true)}>
              최근 {filters.period_months}개월 ▾
            </Chip>
            <IconBtn name="filter" label="상세 필터" onPress={onFilter} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onGlossary ?? (() => onHelp("용어사전"))}
            style={[s.row, { padding: 9 }]}
          >
            <Icon name="book" color={C.brown} />
            <T size={15} bold color={C.brown}>
              용어사전
            </T>
          </Pressable>
        </View>
      ) : (
        <>
          <View
            style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6 }}
          >
            <View
              style={[
                s.row,
                {
                  height: 42,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: C.rule,
                  borderRadius: 12,
                  backgroundColor: C.surface,
                },
              ]}
            >
              <Brand size={32} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="단지·주소·동네 검색"
                onPress={onSearch}
                style={[s.row, { flex: 1, height: 40 }]}
              >
                <Icon name="search" color={C.light} />
                <T color={C.light}>단지·주소·동네 검색</T>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="채팅"
                onPress={(e) => {
                  e.stopPropagation();
                  notify("문의 채팅은 준비 중이에요");
                }}
                style={{ padding: 8 }}
              >
                <Icon name="chat" color={C.light} />
              </Pressable>
            </View>
          </View>
          <View
            style={{
              marginHorizontal: 12,
              marginVertical: 6,
              flexDirection: "row",
              gap: 3,
              padding: 3,
              backgroundColor: C.bg2,
              borderRadius: 12,
            }}
          >
            {(Object.keys(PROPERTY) as (keyof typeof PROPERTY)[]).map((k) => (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: filters.property_type === k }}
                onPress={() => {
                  onFilters(changeProperty(filters, k));
                  if (k === "land") notify("토지는 매매 거래만 볼 수 있어요");
                }}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    filters.property_type === k ? C[k] : "transparent",
                }}
              >
                <T
                  size={15}
                  bold={filters.property_type === k}
                  color={filters.property_type === k ? "#fff" : C.ink}
                >
                  {PROPERTY[k]}
                </T>
              </Pressable>
            ))}
          </View>
          <View
            style={{
              paddingLeft: 12,
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderColor: C.rule,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: 12 }}
            >
              {(Object.keys(DEAL) as (keyof typeof DEAL)[]).map((k) => (
                <Chip
                  key={k}
                  selected={filters.deal_type === k}
                  disabled={isLand && k !== "sale"}
                  onPress={() => {
                    if (isLand && k !== "sale")
                      notify("토지는 매매 거래만 볼 수 있어요");
                    else onFilters(changeDeal(filters, k));
                  }}
                >
                  {DEAL[k]}
                </Chip>
              ))}
              <Chip onPress={() => setPeriod(true)}>
                최근 {filters.period_months}개월 ▾
              </Chip>
              <Chip onPress={onFilter}>☷ 필터</Chip>
            </ScrollView>
          </View>
        </>
      )}
      {isLand && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 6,
            backgroundColor: C.landWash,
          }}
        >
          <T size={13} color={C.land}>
            토지는 매매 거래만 볼 수 있어요
          </T>
        </View>
      )}
      <View style={{ flex: 1, minHeight: 100, position: "relative" }}>
        <View
          testID="map-viewport"
          style={{
            flex: 1,
            marginLeft: panelVisible ? panelWidth : 0,
            position: "relative",
          }}
        >
          <MapCanvas
            key={mapRetry}
            markers={markers}
            property={filters.property_type}
            selected={selected?.kind === "complex" ? selected.id : null}
            unit={unit}
            selectionPoint={
              selected?.kind === "land"
                ? { lat: selected.lat, lng: selected.lng }
                : undefined
            }
            parcelGeometry={
              selected?.kind === "land"
                ? (selected.parcel?.geometry as any)
                : null
            }
            base={base}
            cadastral={isLand || cadastral}
            initial={HOME}
            userLocation={userLocation}
            command={command}
            onEvent={onEvent}
            onMarkerHover={(marker, point) =>
              setHover(marker && point ? { marker, point } : null)
            }
          />
          {desktop && hover && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: Math.max(
                  8,
                  Math.min(
                    hover.point.x + 16,
                    width - (panelVisible ? panelWidth : 0) - 240,
                  ),
                ),
                top: Math.max(8, hover.point.y - 75),
                padding: 14,
                width: 220,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.greenRule,
                borderRadius: 10,
              }}
            >
              <T bold>
                {hover.marker.kind === "parcel"
                  ? "선택한 필지"
                  : hover.marker.name}
              </T>
              {hover.marker.kind !== "parcel" && (
                <T size={13} color={C.muted}>
                  거래 {hover.marker.transaction_count}건
                </T>
              )}
            </View>
          )}
          <View style={{ position: "absolute", right: 12, top: 12, gap: 8 }}>
            <View style={float}>
              <IconBtn
                name="layers"
                label="지도 레이어"
                onPress={() => setLayers(true)}
              />
            </View>
            <View style={float}>
              <IconBtn
                name="plus"
                label="지도 확대"
                onPress={() => move({ type: "zoom", delta: 1 })}
              />
              <View style={s.rule} />
              <IconBtn
                name="minus"
                label="지도 축소"
                onPress={() => move({ type: "zoom", delta: -1 })}
              />
            </View>
          </View>
          <View
            style={{ position: "absolute", right: 12, bottom: 16, ...float }}
          >
            {locating ? (
              <ActivityIndicator style={{ width: 38, height: 38 }} />
            ) : (
              <IconBtn
                name="locate"
                label="내 위치"
                onPress={() => void locate()}
              />
            )}
          </View>
          {!selected && (
            <View style={{ position: "absolute", left: 12, bottom: 16 }}>
              <Btn
                secondary
                small
                icon="list"
                onPress={() => onList({ bbox: camera.bbox })}
              >
                목록 보기
              </Btn>
            </View>
          )}
          {/* D01·D04: 오늘의 용어 카드. 목록 보기 위, 시트가 열리면 숨긴다 */}
          {todayTerm && !selected && !desktop && (
            <View
              style={{ position: "absolute", left: 12, right: 12, bottom: 72 }}
            >
              <TodayTermCard
                term={todayTerm}
                streak={todayStreak}
                completed={todayCompleted}
                onOpen={() => onTodayOpen?.(todayTerm)}
                onClose={() => onTodayClose?.()}
              />
            </View>
          )}
          {loading ? (
            <View
              style={{
                position: "absolute",
                alignSelf: "center",
                top: "42%",
                backgroundColor: C.surface,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: "row",
                gap: 8,
              }}
            >
              <ActivityIndicator size="small" />
              <T size={14}>실거래가 불러오는 중…</T>
            </View>
          ) : error || mapError ? (
            <View
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                top: "20%",
                ...s.card,
              }}
            >
              <StateCard
                error={error ?? mapError}
                onRetry={() => {
                  if (mapError) setMapRetry((x) => x + 1);
                  setMapError(null);
                  setRetry((x) => x + 1);
                }}
              />
            </View>
          ) : !outside && camera.zoom >= 11 && markers.length === 0 ? (
            <View
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                top: "24%",
                ...s.card,
                gap: 12,
              }}
            >
              <T size={19} bold>
                이 조건의 거래가 없어요
              </T>
              {filters.period_months < MAX_PERIOD_MONTHS ? (
                <>
                  <T size={15} color={C.muted}>
                    기간을 늘리면 더 많은 거래를 볼 수 있어요
                  </T>
                  <Btn
                    secondary
                    small
                    onPress={() =>
                      onFilters({
                        ...filters,
                        period_months: MAX_PERIOD_MONTHS,
                      })
                    }
                  >
                    기간 늘리기 (최근 {MAX_PERIOD_MONTHS}개월)
                  </Btn>
                </>
              ) : (
                <T size={15} color={C.muted}>
                  최근 {MAX_PERIOD_MONTHS}개월 동안 이 지역에 신고된 거래가
                  없어요
                </T>
              )}
            </View>
          ) : null}
        </View>
        {desktop && detailSheet}
        {panelVisible && !selected && (
          <View
            accessibilityLabel="지역 요약 패널"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: panelWidth,
              backgroundColor: C.surface,
              borderRightWidth: 1,
              borderColor: C.rule,
              padding: 20,
              gap: 16,
            }}
          >
            <View style={s.between}>
              <T size={23} bold>
                부산 실거래
              </T>
              <IconBtn
                name="close"
                label="지역 패널 닫기"
                onPress={() => setPanelDismissed(true)}
              />
            </View>
            <T color={C.muted}>
              {PROPERTY[filters.property_type]} · {DEAL[filters.deal_type]} ·
              최근 {filters.period_months}개월
            </T>
            {loading ? (
              <StateCard loading />
            ) : error ? (
              <StateCard
                error={error}
                onRetry={() => setRetry((value) => value + 1)}
              />
            ) : (
              <>
                <T bold>지도에서 단지나 지역을 선택하세요</T>
                <T size={14} color={C.muted}>
                  {markers.length
                    ? `지도에 표시된 ${markers.length}곳을 살펴볼 수 있어요.`
                    : "현재 지도 영역에서 조회된 거래가 없어요."}
                </T>
                {markers.length > 0 ? (
                  <ScrollView style={{ flex: 1 }}>
                    {markers
                      .filter(
                        (marker): marker is Exclude<Marker, { kind: "parcel" }> =>
                          marker.kind !== "parcel",
                      )
                      .map((marker) => (
                        <Pressable
                          key={markerId(marker)}
                          onPress={() => markerPress(marker)}
                          accessibilityRole="button"
                          style={{
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderColor: C.rule,
                          }}
                        >
                          <T bold>{marker.name}</T>
                          <T size={13} color={C.muted}>
                            거래 {marker.transaction_count}건
                          </T>
                        </Pressable>
                      ))}
                  </ScrollView>
                ) : (
                  filters.period_months < MAX_PERIOD_MONTHS && (
                    <Btn
                      secondary
                      small
                      onPress={() =>
                        onFilters({
                          ...filters,
                          period_months: nextPeriod(filters.period_months),
                        })
                      }
                    >
                      기간 늘리기 (최근 {nextPeriod(filters.period_months)}개월)
                    </Btn>
                  )
                )}
              </>
            )}
            {todayTerm && (
              <TodayTermCard
                term={todayTerm}
                streak={todayStreak}
                completed={todayCompleted}
                onOpen={() => onTodayOpen?.(todayTerm)}
                onClose={() => onTodayClose?.()}
              />
            )}
          </View>
        )}
      </View>
      {!selected && (
        <Notice
          date={meta?.data_as_of}
          mode={meta?.data_mode ?? repo.mode}
          onPress={onDate}
        />
      )}
      <AdSlot
        width={desktop ? (width >= 1280 ? 728 : 468) : 320}
        height={desktop && width >= 1280 ? 90 : desktop ? 60 : 50}
      />
      {!desktop && detailSheet}
      <Modal
        visible={layers}
        transparent
        animationType="fade"
        onRequestClose={() => setLayers(false)}
      >
        <Pressable
          onPress={() => setLayers(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(17,17,16,.35)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              padding: 22,
              paddingBottom: 32,
              backgroundColor: C.bg,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              gap: 20,
            }}
          >
            <View style={s.between}>
              <T size={22} bold>
                지도 레이어
              </T>
              <IconBtn
                name="close"
                label="지도 레이어 닫기"
                onPress={() => setLayers(false)}
              />
            </View>
            <T bold>지도 종류</T>
            <View style={s.row}>
              <Chip
                selected={base === "normal"}
                onPress={() => onBase("normal")}
              >
                일반지도
              </Chip>
              <Chip
                selected={base === "satellite"}
                onPress={() => onBase("satellite")}
              >
                위성지도
              </Chip>
            </View>
            <View style={s.between}>
              <View>
                <T bold>지적도</T>
                <T size={14} color={C.muted}>
                  땅 경계선과 지번을 지도에 그려요
                </T>
              </View>
              <Switch
                value={isLand || cadastral}
                accessibilityLabel="지적도"
                onValueChange={(v) =>
                  isLand
                    ? notify("토지 모드에서는 지적도가 자동으로 켜져요")
                    : onCadastral(v)
                }
                trackColor={{ true: C.land }}
              />
            </View>
            <T bold>면적 단위</T>
            <View style={s.row}>
              {(["평", "㎡"] as const).map((u) => (
                <Chip key={u} selected={unit === u} onPress={() => onUnit(u)}>
                  {u}
                </Chip>
              ))}
            </View>
            <T size={14} color={C.light}>
              1평 = 3.3058㎡ · 소수 첫째 자리까지
            </T>
            {!process.env.EXPO_PUBLIC_KAKAO_JS_KEY && (
              <T size={14} color={C.muted}>
                샘플 지도에서는 위성·지적도 배경을 확인할 수 없어요
              </T>
            )}
            <Btn onPress={() => setLayers(false)}>확인</Btn>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={period}
        transparent
        animationType="slide"
        onRequestClose={() => setPeriod(false)}
      >
        <Pressable
          onPress={() => setPeriod(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(17,17,16,.35)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              padding: 22,
              backgroundColor: C.bg,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              gap: 16,
            }}
          >
            <View style={s.between}>
              <T size={22} bold>
                조회 기간
              </T>
              <IconBtn
                name="close"
                label="기간 선택 닫기"
                onPress={() => setPeriod(false)}
              />
            </View>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {PERIOD_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  selected={filters.period_months === n}
                  onPress={() => {
                    onFilters({ ...filters, period_months: n });
                    setPeriod(false);
                  }}
                >
                  최근 {n}개월
                </Chip>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <LocationAsk
        visible={askLocation && !interactionBlocked}
        onAllow={() => answerLocation(true)}
        onLater={() => answerLocation(false)}
      />
    </View>
  );
}
const float = {
  backgroundColor: C.surface,
  borderWidth: 1,
  borderColor: C.rule,
  borderRadius: 12,
  boxShadow: "0 1px 2px rgba(17,17,16,.12),0 3px 10px rgba(17,17,16,.14)",
};
