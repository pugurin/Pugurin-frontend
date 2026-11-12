import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { initialLocationStart, markLocationAsked } from "../state/location";
import { LocationAsk } from "../components/LocationAsk";
import type { UserLocation } from "../map/userLocation";
import { HAS_KAKAO } from "../map/kakaoRuntime";
import { RoadviewModal } from "../roadview/RoadviewModal";
import type { Repository } from "../api/repository";
import type {
  Auction,
  BBox,
  ComplexMarker,
  Filters,
  Hospital,
  Redevelopment,
  Marker,
  Meta,
  Parcel,
  RegionMarker,
  School,
  SearchResult,
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
import { AUCTION_MIN_ZOOM } from "../state/auction";
import { SCHOOL_LEVEL, SCHOOL_MIN_ZOOM } from "../state/school";
import {
  HOSPITAL_LIMIT,
  HOSPITAL_MIN_ZOOM,
  hospitalAreas,
  type HospitalArea,
} from "../state/hospital";
import { C } from "../theme/tokens";
import { Brand } from "../components/Brand";
import {
  Btn,
  Chip,
  Icon,
  IconBtn,
  type IconName,
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
import { AuctionContent } from "./AuctionContent";
import { SCHOOL_PEEK, SchoolContent, type ZoneStatus } from "./SchoolContent";
import { containsPoint, geometryBBox } from "../map/geometry";
import { sheetStops } from "../components/sheetMotion";
import type { Geometry } from "geojson";
import { HospitalAreaContent } from "./HospitalAreaContent";
import { RedevelopmentContent } from "./RedevelopmentContent";
import {
  REDEVELOPMENT_MAP_STAGES,
  REDEVELOPMENT_MIN_ZOOM,
} from "../state/redevelopment";
// 병원 원이 없을 때 넘기는 빈 배열. 늘 같은 참조라 지도가 다시 그리지 않는다
const NO_AREAS: HospitalArea[] = [];
// 통학구역 안 단지를 부를 때 쓰는 줌. 지역 묶음이 아니라 단지 마커가 오는 줌이다
const ZONE_COMPLEX_ZOOM = 16;
export type Focus = { result: SearchResult; nonce: number };
// 경매 목록에서 고른 줄. 좌표가 없으면 지도는 그대로 두고 시트만 연다
export type AuctionFocus = {
  id: string;
  lat: number | null;
  lng: number | null;
  nonce: number;
};
export function MapHome({
  repo,
  filters,
  onFilters,
  onSearch,
  onGlossary,
  onToday,
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
  onParcel,
  auction = false,
  onAuction,
  onAuctionList,
  focusAuction,
  schools = false,
  onSchools,
  hospitals = false,
  onHospitals,
  redevelopments = false,
  onRedevelopments,
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
  // 오늘의 용어(짝 맞추기) 바로가기. 카드는 용어사전 탭에 있다
  onToday?: () => void;
  // 땅 정보를 받아 오면 알린다. 오늘의 용어 '매물 카드 번역하기'에 쓴다
  onParcel?: (parcel: Parcel) => void;
  // 경매 탭. 켜면 실거래 마커 대신 경매 마커만 그린다
  auction?: boolean;
  onAuction?: (on: boolean) => void;
  // 경매 목록 화면을 연다. 단지 묶음 마커를 누르면 그 단지로 거른다
  onAuctionList?: (args: {
    bbox: BBox;
    complexId?: string;
    name?: string;
  }) => void;
  // 경매 목록 줄을 누르면 App이 넘긴다. nonce가 바뀔 때마다 그 경매로 이동해 시트를 연다
  focusAuction?: AuctionFocus | null;
  // 학교 레이어. 켜면 줌 14 이상에서 화면 안 학교를 마커로 그린다
  schools?: boolean;
  onSchools?: (on: boolean) => void;
  // 병원 레이어. 켜면 줌 14 이상에서 화면 안 병원을 원으로 묶어 그린다
  hospitals?: boolean;
  onHospitals?: (on: boolean) => void;
  // 재개발 레이어. 켜면 줌 12 이상에서 진행 중인 정비사업 구역을 마커로 그린다
  redevelopments?: boolean;
  onRedevelopments?: (on: boolean) => void;
}) {
  const { width, height } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 1024;
  // 지도 영역 높이. 통학구역을 맞출 때 시트가 가리는 몫을 정하는 데 쓴다
  const [mapHeight, setMapHeight] = useState(0);
  const [hover, setHover] = useState<{
    marker: Marker;
    point: { x: number; y: number };
  } | null>(null);
  const panelWidth = width >= 1280 ? 400 : 360;
  const [panelDismissed, setPanelDismissed] = useState(false);
  // 거래 없는 지역 안내를 닫으면 거래 있는 곳을 한 번 볼 때까지 다시 띄우지 않는다
  const [emptyDismissed, setEmptyDismissed] = useState(false);
  const [camera, setCamera] = useState<Camera>(HOME);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  // 마지막 경매 요청이 성공했는지. 0건 안내에 쓴다
  const [auctionsReady, setAuctionsReady] = useState(false);
  // 경매 탭에서만 보여 주는 경매 요청 오류. 준비 중(404·503)은 따로 둔다
  const [auctionError, setAuctionError] = useState<string | null>(null);
  const [auctionNotReady, setAuctionNotReady] = useState(false);
  // 경매 요청이 진행 중인지. 경매 탭에서 로딩 알약에 쓴다
  const [auctionLoading, setAuctionLoading] = useState(false);
  // 화면 안 학교와 그 응답 meta. meta는 학교 시트에만 쓰고 onMeta로 넘기지 않는다
  const [schoolList, setSchoolList] = useState<School[]>([]);
  const [schoolMeta, setSchoolMeta] = useState<Meta>();
  // 학교 API가 404·503이면 마커 없이 준비 중 안내만 띄운다
  const [schoolNotReady, setSchoolNotReady] = useState(false);
  // 화면 안 병원과 그 응답 meta. meta는 병원 시트에만 쓴다
  const [hospitalList, setHospitalList] = useState<Hospital[]>([]);
  const [hospitalMeta, setHospitalMeta] = useState<Meta>();
  // 병원 API가 404·503이면 원 없이 준비 중 안내만 띄운다
  const [hospitalNotReady, setHospitalNotReady] = useState(false);
  // 고른 초등학교의 통학구역. 학교 시트가 열려 있는 동안만 둔다
  const [zone, setZone] = useState<{
    schoolId: string;
    status: ZoneStatus;
    geometry?: Geometry;
  } | null>(null);
  // 통학구역 안 단지(거래 많은 순). 불러오는 중이면 null, 못 불러오면 undefined로 목록을 숨긴다
  const [zoneComplexes, setZoneComplexes] = useState<
    ComplexMarker[] | null | undefined
  >(undefined);
  // 화면 안 재개발 구역과 그 응답 meta. meta는 재개발 시트에만 쓴다
  const [redevList, setRedevList] = useState<Redevelopment[]>([]);
  const [redevMeta, setRedevMeta] = useState<Meta>();
  // 재개발 API가 404·503이면 마커 없이 준비 중 안내만 띄운다
  const [redevNotReady, setRedevNotReady] = useState(false);
  const [meta, setMeta] = useState<Meta>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapRetry, setMapRetry] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [layers, setLayers] = useState(false);
  // 오른쪽 메뉴바의 실거래 켜짐. 끄면 구·동·단지 실거래 마커를 부르지 않는다
  const [trades, setTrades] = useState(true);
  // 실거래를 켠 채 메뉴바에서 경매도 켰는지. 켜면 경매가 있는 단지 마커에 ⚖ 배지를 붙인다.
  // 경매만 켠 상태는 경매 탭(auction)이다
  const [withAuctions, setWithAuctions] = useState(false);
  // 로드뷰 모드: 켠 동안 지도를 누르면 그 자리의 로드뷰를 연다
  const [roadview, setRoadview] = useState(false);
  const [roadviewAt, setRoadviewAt] = useState<{ lat: number; lng: number } | null>(null);
  const [period, setPeriod] = useState(false);
  const [selected, setSelected] = useState<
    | { kind: "complex"; id: string }
    | { kind: "auction"; id: string }
    | { kind: "school"; school: School; meta?: Meta }
    | { kind: "hospitals"; area: HospitalArea; meta?: Meta }
    | { kind: "redev"; redev: Redevelopment; meta?: Meta }
    | { kind: "region"; marker: RegionMarker }
    | {
        kind: "land";
        lat: number;
        lng: number;
        bbox: BBox;
        region?: { code: string; name: string };
        parcel: Parcel | null;
        picked?: boolean;
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
  const lastAuction = useRef(auction);
  const lastTrades = useRef(trades);
  // 검색으로 고른 단지에 맞춰 유형 탭을 바꿀 때는 필터가 바뀌어도 단지 패널을 닫지 않는다
  const keepSelection = useRef(false);
  const queryBBox = busanQueryBBox(camera.bbox);
  const outside = !queryBBox;
  const isLand = filters.property_type === "land";
  // 경매에는 가격·면적 필터가 적용되지 않으므로, 매매에 이 필터가 걸려 있으면 경매를 그리지 않는다
  const rangeFiltered = [
    filters.price_min,
    filters.price_max,
    filters.exclusive_area_pyeong_min,
    filters.exclusive_area_pyeong_max,
    filters.land_area_pyeong_min,
    filters.land_area_pyeong_max,
  ].some((v) => v !== undefined);
  const auctionZoom = !outside && camera.zoom >= AUCTION_MIN_ZOOM;
  // 실거래 위에 경매를 겹쳐 볼 수 있는지. 경매는 매매 물건이라 매매에서만, 가격·면적 필터가 없을 때만 겹친다
  const auctionOverlay = filters.deal_type === "sale" && !rangeFiltered;
  const showAuctions =
    auctionZoom &&
    (auction || (trades && withAuctions && auctionOverlay));
  const move = (c: MapCommand) => setCommand({ ...c, nonce: ++ref.current });
  // 통학구역을 맞출 때 지도 가장자리 여백 [위, 오른쪽, 아래, 왼쪽]. 오른쪽은 버튼 묶음 자리다.
  // 휴대폰은 학교 시트 peek 높이만큼 아래를 비우되, 지도 절반은 남긴다
  const zonePadding = (): [number, number, number, number] => {
    if (desktop) return [56, 76, 56, 56];
    const peek = sheetStops(height - 54, SCHOOL_PEEK).peek;
    const bottom = mapHeight ? Math.min(peek, mapHeight / 2) : peek;
    return [32, 64, bottom + 16, 24];
  };
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
    if (markers.length > 0) setEmptyDismissed(false);
  }, [markers.length]);
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
    const changed =
      lastFilters.current !== filters ||
      lastAuction.current !== auction ||
      lastTrades.current !== trades;
    lastFilters.current = filters;
    lastAuction.current = auction;
    lastTrades.current = trades;
    if (changed) {
      setMarkers([]);
      setAuctions([]);
      setAuctionsReady(false);
      if (keepSelection.current) keepSelection.current = false;
      else close();
      setPanelDismissed(false);
    }
    // 경매 탭이거나 메뉴바에서 실거래를 끄면 실거래 마커를 부르지 않는다
    if (outside || auction || !trades) {
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
  }, [repo, filters, camera, outside, retry, auction, trades]);
  // 경매 요청. 매매(가격·면적 필터 없음)이거나 경매 탭일 때, 단지 마커가 나오는 줌에서만 부른다.
  // 매매↔경매를 바꾸면 위 effect가 경매 목록을 비우므로 auction이 바뀔 때도 다시 부른다
  useEffect(() => {
    if (!showAuctions) {
      setAuctions([]);
      setAuctionsReady(false);
      setAuctionError(null);
      setAuctionNotReady(false);
      setAuctionLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // 새 요청을 보내는 동안에는 이전 결과의 0건 안내를 지우고 로딩을 띄운다
      setAuctionsReady(false);
      setAuctionLoading(true);
      repo
        .auctions(
          {
            bbox: queryBBox!,
            groups: [filters.property_type],
            pageSize: 500,
          },
          controller.signal,
        )
        .then((r) => {
          if (controller.signal.aborted) return;
          setAuctionLoading(false);
          setAuctions(r.data);
          setAuctionsReady(true);
          setAuctionError(null);
          setAuctionNotReady(false);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          setAuctionLoading(false);
          setAuctions([]);
          setAuctionsReady(false);
          // 404(API 미배포)·503(수집 전)은 준비 중으로 안내한다. 매매에서는 화면에 띄우지 않는다
          const notReady =
            e?.code === "RESOURCE_NOT_FOUND" || e?.code === "DATA_NOT_READY";
          setAuctionNotReady(notReady);
          setAuctionError(
            notReady
              ? null
              : (e?.message ?? "경매 정보를 잠시 불러올 수 없어요"),
          );
        });
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [repo, filters, camera, showAuctions, auction, retry]);
  // 학교 요청. 켜져 있고 부산 안, 줌 14 이상일 때만 bbox로 부른다(level은 보내지 않는다).
  // 탭·필터와 상관없이 같은 요청이다
  useEffect(() => {
    if (!schools || outside || camera.zoom < SCHOOL_MIN_ZOOM) {
      // 이미 비어 있으면 같은 배열을 둬서 지도를 움직일 때마다 마커를 다시 그리지 않게 한다
      setSchoolList((p) => (p.length ? [] : p));
      setSchoolNotReady(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      repo
        .schools(queryBBox!, controller.signal)
        .then((r) => {
          if (controller.signal.aborted) return;
          setSchoolList(r.data);
          setSchoolMeta(r.meta);
          setSchoolNotReady(false);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          // 404(API 미배포)·503(수집 전)은 준비 중으로 안내하고, 그 밖의 오류는 조용히 마커만 뺀다
          setSchoolList([]);
          setSchoolNotReady(
            e?.code === "RESOURCE_NOT_FOUND" || e?.code === "DATA_NOT_READY",
          );
        });
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [repo, camera, schools, outside, retry]);
  // 초등학교 시트를 열면 통학구역을 불러와 지도에 칠하고, 구역이 화면에 들어오게 옮긴다.
  // 통학구역이 없거나(404) 서버 준비 전(503)이면 칠하지 않고 시트에 안내만 둔다
  // 지도에 올릴 학교. 고른 학교는 줌을 줄여 목록이 비어도 남겨 둔다(통학구역의 기준점이다)
  const pickedSchool = selected?.kind === "school" ? selected.school : null;
  const mapSchools = useMemo(
    () =>
      !pickedSchool || schoolList.some((x) => x.id === pickedSchool.id)
        ? schoolList
        : [...schoolList, pickedSchool],
    [schoolList, pickedSchool],
  );
  const zoneSchool =
    selected?.kind === "school" && selected.school.level === "elementary"
      ? selected.school.id
      : null;
  useEffect(() => {
    if (!zoneSchool) {
      setZone(null);
      return;
    }
    const controller = new AbortController();
    setZone({ schoolId: zoneSchool, status: "loading" });
    repo
      .schoolZone(zoneSchool, controller.signal)
      .then((r) => {
        if (controller.signal.aborted) return;
        setZone({ schoolId: zoneSchool, status: "ok", geometry: r.data.geometry });
        // 구역 전체가 보이게 맞춘다. 휴대폰은 아래 시트가 지도를 덮으니 그만큼 아래 여백을 둔다
        const bbox = geometryBBox(r.data.geometry);
        if (bbox) move({ type: "move", bbox, padding: zonePadding() });
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setZone({
          schoolId: zoneSchool,
          status:
            e?.code === "RESOURCE_NOT_FOUND"
              ? "none"
              : e?.code === "DATA_NOT_READY"
                ? "notReady"
                : "error",
        });
      });
    return () => controller.abort();
  }, [repo, zoneSchool]);
  // 통학구역 안 단지. 구역 bbox를 단지 단위 줌으로 불러와 다각형 안 단지만 남긴다.
  // 지금 고른 매물 유형·거래 조건을 그대로 쓴다
  const zoneGeometry = zone?.status === "ok" ? zone.geometry : undefined;
  useEffect(() => {
    const bbox = zoneGeometry && geometryBBox(zoneGeometry);
    if (!zoneGeometry || !bbox) {
      setZoneComplexes(undefined);
      return;
    }
    const controller = new AbortController();
    setZoneComplexes(null);
    repo
      .markers(filters, bbox, ZONE_COMPLEX_ZOOM, controller.signal)
      .then((r) => {
        if (controller.signal.aborted) return;
        setZoneComplexes(
          r.data.markers
            .filter(
              (m): m is ComplexMarker =>
                m.kind === "complex" &&
                containsPoint(zoneGeometry, m.lng, m.lat),
            )
            .sort((a, b) => b.transaction_count - a.transaction_count),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setZoneComplexes(undefined);
      });
    return () => controller.abort();
  }, [repo, zoneGeometry, filters]);
  // 학교 시트가 열린 채 학교 레이어를 끄면 시트도 닫는다
  useEffect(() => {
    if (!schools && selected?.kind === "school") close();
  }, [schools]);
  // 재개발 요청. 켜짐·부산 안·줌 12 이상에서 bbox로 부른다. 진행 중인 단계만 받는다
  useEffect(() => {
    if (!redevelopments || outside || camera.zoom < REDEVELOPMENT_MIN_ZOOM) {
      setRedevList((p) => (p.length ? [] : p));
      setRedevNotReady(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      repo
        .redevelopments(queryBBox!, REDEVELOPMENT_MAP_STAGES, controller.signal)
        .then((r) => {
          if (controller.signal.aborted) return;
          setRedevList(r.data);
          setRedevMeta(r.meta);
          setRedevNotReady(false);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          // 404·503은 준비 중으로 안내하고, 그 밖의 오류는 조용히 마커만 뺀다
          setRedevList((p) => (p.length ? [] : p));
          setRedevNotReady(
            e?.code === "RESOURCE_NOT_FOUND" || e?.code === "DATA_NOT_READY",
          );
        });
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [repo, camera, redevelopments, outside, retry]);
  // 재개발 시트가 열린 채 재개발 레이어를 끄면 시트도 닫는다
  useEffect(() => {
    if (!redevelopments && selected?.kind === "redev") close();
  }, [redevelopments]);
  // 병원 요청. 학교와 같은 조건(켜짐·부산 안·줌 14 이상)에서 bbox로 부른다.
  // tier는 Repository가 붙이고, 탭·필터와 상관없이 같은 요청이다
  useEffect(() => {
    if (!hospitals || outside || camera.zoom < HOSPITAL_MIN_ZOOM) {
      // 이미 비어 있으면 같은 배열을 둬서 지도를 움직일 때마다 원을 다시 그리지 않게 한다
      setHospitalList((p) => (p.length ? [] : p));
      setHospitalNotReady(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      repo
        .hospitals(queryBBox!, controller.signal)
        .then((r) => {
          if (controller.signal.aborted) return;
          setHospitalList(r.data);
          setHospitalMeta(r.meta);
          setHospitalNotReady(false);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          // 404·503은 준비 중으로 안내하고, 그 밖의 오류는 조용히 원만 뺀다
          setHospitalList((p) => (p.length ? [] : p));
          setHospitalNotReady(
            e?.code === "RESOURCE_NOT_FOUND" || e?.code === "DATA_NOT_READY",
          );
        });
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [repo, camera, hospitals, outside, retry]);
  // 병원 시트가 열린 채 병원 레이어를 끄면 시트도 닫는다
  useEffect(() => {
    if (!hospitals && selected?.kind === "hospitals") close();
  }, [hospitals]);
  // 화면 거리로 묶은 병원 원. 병원이 없으면 같은 빈 배열을 둬 지도가 다시 그리지 않게 한다
  const areas = useMemo(
    () =>
      hospitalList.length ? hospitalAreas(hospitalList, camera.zoom) : NO_AREAS,
    [hospitalList, camera.zoom],
  );
  // 병원 시트가 열린 채 원이 다시 묶이면 같은 id 원으로 바꾸고, 그 id가 없어지면 시트를 닫는다
  useEffect(() => {
    if (selected?.kind !== "hospitals") return;
    const next = areas.find((a) => a.id === selected.area.id);
    if (!next) close();
    else if (next !== selected.area) setSelected({ ...selected, area: next });
  }, [areas]);
  useEffect(() => {
    if (!focus) return;
    close();
    const r = focus.result;
    if (r.type === "school" && r.school) {
      // 학교 레이어를 켜고 그 학교 시트를 연다. 초등학교면 통학구역 효과가 구역에 맞춰 다시 옮긴다
      onSchools?.(true);
      setSelected({ kind: "school", school: r.school, meta: schoolMeta });
      setStage("peek");
      move({ type: "move", lat: r.lat, lng: r.lng, zoom: 15 });
    } else if (r.type === "complex" && r.complex_id) {
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
  useEffect(() => {
    if (!focusAuction) return;
    close();
    setSelected({ kind: "auction", id: focusAuction.id });
    setStage("peek");
    if (focusAuction.lat != null && focusAuction.lng != null)
      move({
        type: "move",
        lat: focusAuction.lat,
        lng: focusAuction.lng,
        zoom: Math.max(camera.zoom, AUCTION_MIN_ZOOM),
      });
  }, [focusAuction]);
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
      picked: true,
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
      if (e.id.startsWith("auction:")) {
        pendingLand.current = null;
        landRequest.current?.abort();
        setSelected({ kind: "auction", id: e.id.slice("auction:".length) });
        setStage("peek");
      } else if (e.id.startsWith("school:")) {
        const school = schoolList.find((x) => `school:${x.id}` === e.id);
        if (school) {
          pendingLand.current = null;
          landRequest.current?.abort();
          setSelected({ kind: "school", school, meta: schoolMeta });
          setStage("peek");
        }
      } else if (e.id.startsWith("redev:")) {
        const redev = redevList.find((x) => `redev:${x.id}` === e.id);
        if (redev) {
          pendingLand.current = null;
          landRequest.current?.abort();
          setSelected({ kind: "redev", redev, meta: redevMeta });
          setStage("peek");
        }
      } else if (e.id.startsWith("hospital-area:")) {
        // 원 라벨을 누르면 그 원의 병원 시트를 연다(확대하지 않는다)
        const area = areas.find((a) => a.id === e.id);
        if (area) {
          pendingLand.current = null;
          landRequest.current?.abort();
          setSelected({ kind: "hospitals", area, meta: hospitalMeta });
          setStage("peek");
        }
      } else if (e.id.startsWith("auction-group:")) {
        // 한 단지에 경매가 여러 건이면 그 단지로 거른 경매 목록을 연다
        const complexId = e.id.slice("auction-group:".length);
        const c = markers.find(
          (m) => m.kind === "complex" && m.complex_id === complexId,
        );
        onAuctionList?.({
          bbox: camera.bbox,
          complexId,
          name: c?.kind === "complex" ? c.name : undefined,
        });
      } else {
        const m = markers.find((m) => markerId(m) === e.id);
        if (m) markerPress(m);
      }
    }
    if (e.type === "mapClick") {
      if (roadview) setRoadviewAt({ lat: e.lat, lng: e.lng });
      else if (!isLand) close();
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
  // 경매 탭에서는 필터·목록 버튼이 경매 목록을 연다. 경매 필터 시트는 목록 화면에 있다
  const openFilter = () =>
    auction ? onAuctionList?.({ bbox: camera.bbox }) : onFilter();
  const openList = () =>
    auction
      ? onAuctionList?.({ bbox: camera.bbox })
      : onList({ bbox: camera.bbox });
  // 경매 탭 안내. 준비 중도 오류 카드가 아닌 일반 안내로 띄운다(다시 시도 없음)
  const auctionNotice =
    !auction || outside
      ? null
      : !auctionZoom
        ? "확대하면 경매 물건이 보여요"
        : auctionNotReady
          ? "경매 정보를 준비 중이에요"
          : auctionsReady && auctions.length === 0
            ? "이 화면 안에 진행 중인 경매가 없어요"
            : null;
  // 지도 가운데 안내 상태. 로딩 알약 → 오류 카드 → 안내 묶음(경매 안내·빈 지역 카드·학교 준비 중) 순이다
  const busy = loading || (auction && auctionLoading);
  const errorShown =
    !busy && !!(error || mapError || (auction && auctionError));
  const auctionCard = !busy && !errorShown && auction && !!auctionNotice;
  const emptyCard =
    !busy &&
    !errorShown &&
    !auction &&
    trades &&
    !outside &&
    camera.zoom >= 11 &&
    markers.length === 0 &&
    !emptyDismissed;
  // 학교 준비 중 안내. 오류 카드가 떠 있을 때는 숨긴다
  const schoolNotice = schools && schoolNotReady && !errorShown;
  // 병원 준비 중 안내와 서버 상한(500곳) 안내. 오류 카드가 떠 있을 때는 둘 다 숨긴다
  const hospitalNotice = hospitals && hospitalNotReady && !errorShown;
  // 재개발 준비 중 안내
  const redevNotice = redevelopments && redevNotReady && !errorShown;
  const hospitalLimitNotice =
    hospitals &&
    !outside &&
    camera.zoom >= HOSPITAL_MIN_ZOOM &&
    hospitalList.length >= HOSPITAL_LIMIT &&
    !errorShown;
  // 학교 범례. 켜져 있고 줌 14 이상이며 준비 중이 아닐 때만. 기타는 화면 안에 있을 때만 더한다
  const schoolLegend =
    schools && !outside && camera.zoom >= SCHOOL_MIN_ZOOM && !schoolNotReady
      ? (["elementary", "middle", "high", "special", "other"] as const).filter(
          (l) => l !== "other" || schoolList.some((x) => x.level === "other"),
        )
      : null;
  const detailSheet = selected ? (
    <Sheet
      key={
        selected.kind === "complex"
          ? `complex:${selected.id}`
          : selected.kind === "auction"
            ? `auction:${selected.id}`
            : selected.kind === "school"
              ? `school:${selected.school.id}`
              : selected.kind === "hospitals"
                ? selected.area.id
                : selected.kind === "redev"
                ? `redev:${selected.redev.id}`
                : selected.kind === "land"
                ? `land:${selected.lat},${selected.lng}`
                : `region:${selected.marker.region_code}`
      }
      stage={desktop ? "full" : stage}
      onStage={desktop ? () => {} : setStage}
      onClose={close}
      // 학교 시트는 peek 하나에 내용이 다 보이도록 더 높게 연다
      peek={selected.kind === "school" ? SCHOOL_PEEK : undefined}
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
          picked={selected.picked}
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
      ) : selected.kind === "school" ? (
        <SchoolContent
          school={selected.school}
          meta={selected.meta}
          zone={
            zone?.schoolId === selected.school.id ? zone.status : undefined
          }
          complexes={
            zone?.schoolId === selected.school.id ? zoneComplexes : undefined
          }
          property={filters.property_type}
          unit={unit}
          onComplex={(id) => {
            setSelected({ kind: "complex", id });
            setStage("peek");
          }}
        />
      ) : selected.kind === "hospitals" ? (
        <HospitalAreaContent area={selected.area} meta={selected.meta} />
      ) : selected.kind === "redev" ? (
        <RedevelopmentContent
          r={selected.redev}
          meta={selected.meta}
          unit={unit}
        />
      ) : selected.kind === "auction" ? (
        <AuctionContent
          id={selected.id}
          repo={repo}
          stage={desktop ? "full" : stage}
          onStage={setStage}
          unit={unit}
          notify={notify}
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
          onAuction={(id) => {
            setSelected({ kind: "auction", id });
            setStage("peek");
          }}
          onAuctionList={(complexId, name) =>
            onAuctionList?.({ bbox: camera.bbox, complexId, name })
          }
        />
      ) : (
        <>
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
          <Brand size={34} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="단지·동네·학교 검색"
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
              단지·동네·학교 검색
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
                  selected={!auction && filters.deal_type === key}
                  disabled={isLand && key !== "sale"}
                  onPress={() => {
                    onAuction?.(false);
                    setTrades(true);
                    onFilters(changeDeal(filters, key));
                  }}
                >
                  {DEAL[key]}
                </Chip>
              ))}
            {/* 경매 칩은 DEAL 칩이 숨는 폭에서도 보여야 경매 탭을 고를 수 있다 */}
            <Chip selected={auction} onPress={() => onAuction?.(true)}>
              경매
            </Chip>
            {!auction && (
              <Chip onPress={() => setPeriod(true)}>
                최근 {filters.period_months}개월 ▾
              </Chip>
            )}
            <IconBtn name="filter" label="상세 필터" onPress={openFilter} />
          </View>
          {onToday && (
            <IconBtn name="today" label="오늘의 용어" onPress={onToday} />
          )}
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
                accessibilityLabel="단지·동네·학교 검색"
                onPress={onSearch}
                style={[s.row, { flex: 1, height: 40 }]}
              >
                <Icon name="search" color={C.light} />
                <T color={C.light}>단지·동네·학교 검색</T>
              </Pressable>
              {onToday && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="오늘의 용어"
                  onPress={onToday}
                  style={{ padding: 8 }}
                >
                  <Icon name="today" color={C.light} />
                </Pressable>
              )}
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
                  selected={!auction && filters.deal_type === k}
                  disabled={isLand && k !== "sale"}
                  onPress={() => {
                    if (isLand && k !== "sale")
                      notify("토지는 매매 거래만 볼 수 있어요");
                    else {
                      onAuction?.(false);
                      setTrades(true);
                      onFilters(changeDeal(filters, k));
                    }
                  }}
                >
                  {DEAL[k]}
                </Chip>
              ))}
              <Chip selected={auction} onPress={() => onAuction?.(true)}>
                경매
              </Chip>
              {!auction && (
                <Chip onPress={() => setPeriod(true)}>
                  최근 {filters.period_months}개월 ▾
                </Chip>
              )}
              <Chip onPress={openFilter}>☷ 필터</Chip>
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
          onLayout={(e) => setMapHeight(e.nativeEvent.layout.height)}
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
            auctions={auctions}
            schools={mapSchools}
            hospitalAreas={areas}
            redevelopments={redevList}
            selected={
              selected?.kind === "complex"
                ? selected.id
                : selected?.kind === "auction"
                  ? `auction:${selected.id}`
                  : selected?.kind === "school"
                    ? `school:${selected.school.id}`
                    : selected?.kind === "redev"
                      ? `redev:${selected.redev.id}`
                      : null
            }
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
            schoolZone={zone?.geometry ?? null}
            base={base}
            cadastral={isLand || cadastral}
            roadview={roadview}
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
          {/* 오른쪽 버튼 묶음은 지도 가운데 오류·안내 카드보다 위에 둔다 */}
          <View
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              gap: 8,
              zIndex: 2,
            }}
          >
            {/* 메뉴바. 누른 종류의 마커만 지도에 그린다. 실거래와 경매는 따로 켜고 끈다.
                실거래+경매는 단지 마커에 ⚖ 배지, 경매만은 경매 탭이다 */}
            <View style={[float, { overflow: "hidden" }]}>
              <RailBtn
                icon="home"
                label="실거래"
                active={trades && !auction}
                onPress={() => {
                  if (auction) {
                    // 경매만 → 실거래+경매
                    onAuction?.(false);
                    setTrades(true);
                    setWithAuctions(auctionOverlay);
                  } else if (trades && withAuctions) {
                    // 실거래+경매 → 경매만
                    setWithAuctions(false);
                    onAuction?.(true);
                  } else setTrades(!trades);
                }}
              />
              <View style={s.rule} />
              <RailBtn
                icon="gavel"
                label="경매"
                active={auction || (trades && withAuctions)}
                onPress={() => {
                  if (auction) {
                    // 경매만 → 모두 끔
                    onAuction?.(false);
                    setTrades(false);
                  } else if (!trades) onAuction?.(true);
                  else if (withAuctions) setWithAuctions(false);
                  else if (auctionOverlay) setWithAuctions(true);
                  else
                    notify(
                      "경매는 매매에서 가격·면적 필터 없이 같이 볼 수 있어요",
                    );
                }}
              />
              <View style={s.rule} />
              <RailBtn
                icon="school"
                label="학교"
                active={schools}
                onPress={() => onSchools?.(!schools)}
              />
              <View style={s.rule} />
              <RailBtn
                icon="hospital"
                label="병원"
                active={hospitals}
                onPress={() => onHospitals?.(!hospitals)}
              />
              <View style={s.rule} />
              <RailBtn
                icon="redev"
                label="재개발"
                active={redevelopments}
                onPress={() => onRedevelopments?.(!redevelopments)}
              />
            </View>
            <View style={float}>
              <IconBtn
                name="layers"
                label="지도 레이어"
                onPress={() => setLayers(true)}
              />
            </View>
            {HAS_KAKAO && (
              <View style={float}>
                <IconBtn
                  name="roadview"
                  label="로드뷰 모드"
                  active={roadview}
                  onPress={() => {
                    if (!roadview)
                      notify("파란 길을 누르면 그 자리 로드뷰를 볼 수 있어요");
                    setRoadview(!roadview);
                  }}
                />
              </View>
            )}
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
              <Btn secondary small icon="list" onPress={openList}>
                목록 보기
              </Btn>
            </View>
          )}
          {busy ? (
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
              <T size={14}>
                {auction ? "경매 불러오는 중…" : "실거래가 불러오는 중…"}
              </T>
            </View>
          ) : errorShown ? (
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
                error={error ?? mapError ?? auctionError}
                onRetry={() => {
                  if (mapError) setMapRetry((x) => x + 1);
                  setMapError(null);
                  setRetry((x) => x + 1);
                }}
              />
            </View>
          ) : null}
          {/* 지도 가운데 안내는 한 세로 묶음에 쌓아 서로 겹치지 않게 한다.
              경매 안내나 빈 지역 카드가 먼저, 학교·병원 안내가 그 아래다 */}
          {!errorShown &&
            (auctionCard ||
              emptyCard ||
              schoolNotice ||
              hospitalNotice ||
              hospitalLimitNotice ||
              redevNotice) && (
            <View
              testID="map-notices"
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                top: "24%",
                alignItems: "center",
                gap: 8,
              }}
            >
              {auctionCard && (
                <View style={{ ...s.card, maxWidth: 300 }}>
                  <T size={16} bold>
                    {auctionNotice}
                  </T>
                </View>
              )}
              {emptyCard && (
                <View
                  style={{ ...s.card, width: "100%", maxWidth: 300, gap: 10 }}
                >
                  <View style={s.between}>
                    <T size={18} bold style={{ flex: 1 }}>
                      이 조건의 거래가 없어요
                    </T>
                    <IconBtn
                      name="close"
                      label="안내 닫기"
                      onPress={() => setEmptyDismissed(true)}
                      style={{ width: 30, height: 30, marginRight: -4 }}
                    />
                  </View>
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
              )}
              {schoolNotice && (
                <View
                  testID="school-notice"
                  pointerEvents="none"
                  style={{ ...s.card, maxWidth: 300 }}
                >
                  <T size={16} bold>
                    학교 정보를 준비 중이에요
                  </T>
                </View>
              )}
              {hospitalNotice && (
                <View
                  testID="hospital-notice"
                  pointerEvents="none"
                  style={{ ...s.card, maxWidth: 300 }}
                >
                  <T size={16} bold>
                    병원 정보를 준비 중이에요
                  </T>
                </View>
              )}
              {hospitalLimitNotice && (
                <View
                  testID="hospital-limit-notice"
                  pointerEvents="none"
                  style={{ ...s.card, maxWidth: 300 }}
                >
                  <T size={16} bold>
                    병원이 많아 일부만 세었어요. 확대하면 정확해져요
                  </T>
                </View>
              )}
              {redevNotice && (
                <View
                  testID="redev-notice"
                  pointerEvents="none"
                  style={{ ...s.card, maxWidth: 300 }}
                >
                  <T size={16} bold>
                    재개발 정보를 준비 중이에요
                  </T>
                </View>
              )}
            </View>
          )}
          {schoolLegend && (
            <View
              accessibilityLabel="학교 범례"
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 12,
                // 목록 보기 버튼(높이 38) 위에 둔다
                bottom: selected ? 16 : 62,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
                ...float,
                borderRadius: 8,
              }}
            >
              {schoolLegend.map((l) => {
                const { color, shape, legend } = SCHOOL_LEVEL[l];
                return (
                  <View
                    key={l}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={
                          shape === "circle"
                            ? {
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: color,
                              }
                            : shape === "square"
                              ? {
                                  width: 9,
                                  height: 9,
                                  borderRadius: 2,
                                  backgroundColor: color,
                                }
                              : {
                                  width: 7,
                                  height: 7,
                                  borderRadius: 1,
                                  backgroundColor: color,
                                  transform: [{ rotate: "45deg" }],
                                }
                        }
                      />
                    </View>
                    <T size={12} bold color={C.ink2}>
                      {legend}
                    </T>
                  </View>
                );
              })}
            </View>
          )}
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
                {auction
                  ? `경매 물건 · ${PROPERTY[filters.property_type]}`
                  : "부산 실거래"}
              </T>
              <IconBtn
                name="close"
                label="지역 패널 닫기"
                onPress={() => setPanelDismissed(true)}
              />
            </View>
            {/* 경매 탭에는 실거래 요약 대신 경매 목록으로 가는 버튼만 둔다 */}
            {auction ? (
              <Btn
                secondary
                small
                icon="list"
                onPress={() => onAuctionList?.({ bbox: camera.bbox })}
              >
                경매 목록 보기
              </Btn>
            ) : (
              <T color={C.muted}>
                {PROPERTY[filters.property_type]} · {DEAL[filters.deal_type]} ·
                최근 {filters.period_months}개월
              </T>
            )}
            {auction ? null : loading ? (
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
                        (
                          marker,
                        ): marker is Exclude<Marker, { kind: "parcel" }> =>
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
      {!desktop && detailSheet}
      {roadviewAt && (
        <RoadviewModal
          visible
          title="선택한 위치"
          lat={roadviewAt.lat}
          lng={roadviewAt.lng}
          onClose={() => setRoadviewAt(null)}
        />
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
// 오른쪽 메뉴바 버튼. 켜지면 진한 바탕에 흰 글자로 보인다
function RailBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} 보기`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        paddingVertical: 5,
        alignItems: "center",
        gap: 1,
        backgroundColor: active ? C.ink : pressed ? C.bg2 : C.surface,
      })}
    >
      <Icon name={icon} size={17} color={active ? C.surface : C.ink} />
      <T size={12} bold={active} color={active ? C.surface : C.ink}>
        {label}
      </T>
    </Pressable>
  );
}
const float = {
  backgroundColor: C.surface,
  borderWidth: 1,
  borderColor: C.rule,
  borderRadius: 12,
  boxShadow: "0 1px 2px rgba(17,17,16,.12),0 3px 10px rgba(17,17,16,.14)",
};
