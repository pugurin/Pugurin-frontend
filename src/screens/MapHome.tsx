import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import * as Location from "expo-location";
import type { Repository } from "../api/repository";
import type {
  BBox,
  Filters,
  Marker,
  Meta,
  RegionMarker,
  SearchResult,
} from "../api/types";
import {
  changeDeal,
  changeProperty,
  DEFAULT_FILTERS,
  DEAL,
  HOME,
  inBusan,
  markerId,
  PROPERTY,
} from "../state/market";
import { C } from "../theme/tokens";
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
export type Focus = { result: SearchResult; nonce: number };
export function MapHome({
  repo,
  filters,
  onFilters,
  onSearch,
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
}: {
  repo: Repository;
  filters: Filters;
  onFilters: (f: Filters) => void;
  onSearch: () => void;
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
}) {
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
    | null
  >(null);
  const [stage, setStage] = useState<SheetStage>("peek");
  const [command, setCommand] = useState<MapCommand & { nonce: number }>();
  const [locating, setLocating] = useState(false);
  const ref = useRef(0);
  const lastFilters = useRef(filters);
  const outside = !inBusan(camera.lat, camera.lng);
  const isLand = filters.property_type === "land";
  const move = (c: MapCommand) => setCommand({ ...c, nonce: ++ref.current });
  const close = () => setSelected(null);
  useEffect(() => {
    const controller = new AbortController();
    if (outside) {
      setLoading(false);
      setMarkers([]);
      setError(null);
      return () => controller.abort();
    }
    const changed = lastFilters.current !== filters;
    lastFilters.current = filters;
    if (changed) {
      setMarkers([]);
      close();
    }
    setError(null);
    const loadingTimer = setTimeout(() => setLoading(true), 250);
    const timer = setTimeout(
      () =>
        repo
          .markers(
            filters,
            camera.bbox,
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
    const r = focus.result;
    if (r.type === "complex" && r.complex_id) {
      setSelected({ kind: "complex", id: r.complex_id });
      setStage("peek");
      move({ type: "move", lat: r.lat, lng: r.lng, zoom: 15 });
    } else if (r.type === "region") {
      close();
      move({
        type: "move",
        bbox: r.bbox,
        lat: r.lat,
        lng: r.lng,
        zoom: r.region_level === "sigungu" ? 12 : 14,
      });
    } else {
      notify("토지 상세는 이번 구현 범위에 포함되지 않아요");
      move({ type: "move", lat: r.lat, lng: r.lng, zoom: 15 });
    }
  }, [focus]);
  const markerPress = (m: Marker) => {
    if (m.kind === "region") {
      setSelected({ kind: "region", marker: m });
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
    } else notify("토지 상세는 이번 구현 범위에 포함되지 않아요");
  };
  const onEvent = (e: MapEvent) => {
    if (e.type === "camera") {
      if (e.bbox.every(Number.isFinite))
        setCamera({ lat: e.lat, lng: e.lng, zoom: e.zoom, bbox: e.bbox });
    }
    if (e.type === "marker") {
      const m = markers.find((m) => markerId(m) === e.id);
      if (m) markerPress(m);
    }
    if (e.type === "mapClick") {
      if (isLand) notify("토지 상세는 이번 구현 범위에 포함되지 않아요");
      else close();
    }
    if (e.type === "error") setMapError(e.message);
  };
  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        notify("위치 권한이 꺼져 있어요. 휴대폰 설정에서 켤 수 있어요");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!inBusan(loc.coords.latitude, loc.coords.longitude)) {
        notify("현재 위치는 부산 밖이에요. 부산 지도에서 계속 볼 수 있어요");
        return;
      }
      move({
        type: "move",
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        zoom: 15,
      });
    } catch {
      notify("현재 위치를 확인할 수 없어요. 위치 설정을 확인해 주세요");
    } finally {
      setLocating(false);
    }
  };
  return (
    <View style={s.screen}>
      <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onSearch}
          style={[
            s.row,
            {
              height: 50,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: C.rule,
              borderRadius: 12,
              backgroundColor: C.surface,
            },
          ]}
        >
          <Icon name="search" color={C.light} />
          <T color={C.light} style={{ flex: 1 }}>
            단지·주소·동네 검색
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="채팅"
            onPress={(e) => {
              e.stopPropagation();
              notify("중개사 채팅은 2차에서 열려요");
            }}
            style={{ padding: 8 }}
          >
            <Icon name="chat" color={C.light} />
          </Pressable>
        </Pressable>
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
              height: 44,
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
        <MapCanvas
          key={mapRetry}
          markers={markers}
          property={filters.property_type}
          selected={selected?.kind === "complex" ? selected.id : null}
          unit={unit}
          base={base}
          cadastral={isLand || cadastral}
          initial={HOME}
          command={command}
          onEvent={onEvent}
        />
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
        <View style={{ position: "absolute", right: 12, bottom: 16, ...float }}>
          {locating ? (
            <ActivityIndicator style={{ width: 48, height: 48 }} />
          ) : (
            <IconBtn
              name="locate"
              label="내 위치"
              onPress={() => void locate()}
            />
          )}
        </View>
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
        {outside ? (
          <View
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: 12,
              ...s.card,
              gap: 12,
            }}
          >
            <T bold>부산 지역만 지원해요</T>
            <Btn small onPress={() => move({ type: "move", ...HOME })}>
              부산으로 돌아가기
            </Btn>
          </View>
        ) : loading ? (
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
        ) : markers.length === 0 ? (
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
            <T size={15} color={C.muted}>
              기간을 늘리면 더 많은 거래를 볼 수 있어요
            </T>
            <Btn
              secondary
              small
              onPress={() =>
                onFilters({
                  ...filters,
                  period_months:
                    filters.period_months < 12
                      ? 12
                      : Math.min(60, filters.period_months * 2),
                })
              }
            >
              기간 늘리기
            </Btn>
          </View>
        ) : null}
      </View>
      <Notice
        date={meta?.data_as_of}
        mode={meta?.data_mode ?? repo.mode}
        onPress={onDate}
      />
      <AdSlot />
      {selected && (
        <Sheet stage={stage} onStage={setStage} onClose={close}>
          {selected.kind === "complex" ? (
            <ComplexContent
              key={selected.id}
              id={selected.id}
              repo={repo}
              filters={filters}
              stage={stage}
              onStage={setStage}
              onHelp={onHelp}
              notify={notify}
              unit={unit}
            />
          ) : (
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
            />
          )}
        </Sheet>
      )}
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
              {[3, 6, 12, 24, 36, 60].map((n) => (
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
