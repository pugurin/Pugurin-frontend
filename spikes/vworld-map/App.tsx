// D1(#4) 지도 시험 구현 — MapLibre React Native
// 배경 지도: VWorld 키가 없으면 OpenFreeMap(키 불필요), 있으면 VWorld 일반·위성·지적도까지
// 확인 항목: ① 마커 500개 성능(심볼 레이어 vs RN 뷰 마커) ② 지적도 켜기/끄기
//           ③ 탭 좌표 ④ 필지 폴리곤 하이라이트 ⑤ 줌 체계(웹 메르카토르) ⑥ 배경 지도 전환
//           ⑦ 백엔드 /map/markers 연결 (api.ts)
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  RasterSource,
  TransformRequestManager,
  type CameraRef,
  type MapRef,
  type ViewState,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { API_BASE, fetchMarkers, markerId, markerLabel, toServerZoom, type Level, type MapMarker, type PropertyType } from './api';

const VWORLD_KEY = process.env.EXPO_PUBLIC_VWORLD_KEY ?? '';
const VWORLD_DOMAIN = process.env.EXPO_PUBLIC_VWORLD_DOMAIN ?? '';

// 부산시청 주변 (디자인: 위치 권한 거부 시 시작 지점)
const BUSAN: [number, number] = [129.075, 35.1798];
// 디자인 문서의 줌(11.4 등)은 표준 줌 기준 → MapLibre에서는 1을 뺀다
const START_ZOOM = 10.4;
const COUNTS = [0, 50, 200, 500] as const;
type DataSource = 'fake' | 'server';
const PROPERTY_TYPES: { v: PropertyType; t: string }[] = [
  { v: 'apartment', t: '아파트' }, { v: 'officetel', t: '오피스텔' }, { v: 'villa', t: '빌라' }, { v: 'land', t: '토지' },
];
type MarkerMode = 'symbol' | 'view';
type Base = 'OpenFreeMap' | 'Base' | 'Satellite';

// 디자인 토큰 일부 (docs/design/busan-map-glossary/README.md)
const C = { apartment: '#3E64A0', land: '#4F7A3A', ink: '#111110', ink2: '#2A2A28', rule: '#DCDCD5', primary: '#1F1E1B', bg: '#FAFAF7' };

// VWorld WMTS: 배경(png) · 위성(jpeg). 줌 6~19
const wmts = (layer: Exclude<Base, 'OpenFreeMap'>) =>
  `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${layer}/{z}/{y}/{x}.${layer === 'Satellite' ? 'jpeg' : 'png'}`;

// VWorld WMS: 연속지적도(본번·부번 경계선)
const CADASTRAL_WMS =
  'https://api.vworld.kr/req/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0' +
  '&LAYERS=lp_pa_cbnd_bubun,lp_pa_cbnd_bonbun&STYLES=lp_pa_cbnd_bubun_line,lp_pa_cbnd_bonbun_line' +
  '&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true' +
  `&KEY=${VWORLD_KEY}&DOMAIN=${encodeURIComponent(VWORLD_DOMAIN)}`;

// OpenFreeMap: 키 없이 쓰는 무료 벡터 지도 (OpenStreetMap 데이터). 개발·시연용
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

// VWorld 타일을 얹을 때 쓰는 빈 스타일 (배경색 + 글리프만)
// 숫자·영문 글리프는 글리프 서버, 한글은 기기 폰트로 로컬 렌더링된다.
const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#EDEDE8' } }],
};

// OpenFreeMap 지명을 한글 우선으로 바꾼다 ("Busan\n부산" → "부산")
function koreanLabels(style: StyleSpecification): StyleSpecification {
  const name = ['coalesce', ['get', 'name:ko'], ['get', 'name:nonlatin'], ['get', 'name']];
  return {
    ...style,
    layers: style.layers.map((l) =>
      l.type === 'symbol' && l.layout?.['text-field'] ? { ...l, layout: { ...l.layout, 'text-field': name } } : l,
    ) as StyleSpecification['layers'],
  };
}

type Spot = { id: string; lng: number; lat: number; price: string; area: string };

// 부산 시내 범위에 고정 시드로 가짜 단지 좌표를 뿌린다
function makeSpots(n: number): Spot[] {
  let s = 42;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    lat: 35.08 + rnd() * 0.17,
    lng: 128.97 + rnd() * 0.24,
    price: `${(3 + rnd() * 20).toFixed(1).replace(/\.0$/, '')}억`,
    area: `${[24, 32, 34, 41][Math.floor(rnd() * 4)]}평`,
  }));
}

// 탭한 지점 주변 약 20m 사각형 (실제 앱은 /parcels/lookup 의 geometry 사용)
function fakeParcel([lng, lat]: [number, number]): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = 0.00009, dLng = 0.00011;
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]],
    },
  };
}

// 디자인의 단지 마커 모양을 단순화한 RN 뷰
function ComplexMarkerView({ price, area }: { price: string; area: string }) {
  return (
    <View style={styles.mk}>
      <View style={styles.mkTop}><Text style={styles.mkPrice}>{price}</Text></View>
      <View style={styles.mkBottom}><Text style={styles.mkSub}>{area}</Text></View>
    </View>
  );
}

export default function App() {
  const [source, setSource] = useState<DataSource>('server');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [view, setView] = useState<Pick<ViewState, 'bounds' | 'zoom'> | null>(null);
  const [api, setApi] = useState<{ level: Level; markers: MapMarker[]; dataMode: string | null } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const [count, setCount] = useState<(typeof COUNTS)[number]>(50);
  const [mode, setMode] = useState<MarkerMode>('symbol');
  const [base, setBase] = useState<Base>(VWORLD_KEY ? 'Base' : 'OpenFreeMap');
  const [freeStyle, setFreeStyle] = useState<StyleSpecification | null>(null);
  const [cadastral, setCadastral] = useState(false);
  const [zoom, setZoom] = useState(START_ZOOM);
  const [tap, setTap] = useState<[number, number] | null>(null);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [jsFps, setJsFps] = useState(0);
  const changedAt = useRef(performance.now());
  const cameraRef = useRef<CameraRef>(null);
  // 디자인: +/− 는 정수 줌 단위, 260ms
  const stepZoom = (d: number) => cameraRef.current?.zoomTo(Math.round(zoom) + d, { duration: 260 });

  // 인증키에 등록한 서비스 URL을 Referer로 붙인다 (VWorld가 도메인을 검사하는 경우 대비)
  useEffect(() => {
    if (!VWORLD_DOMAIN) return;
    const id = TransformRequestManager.addHeader({ match: 'api.vworld.kr', name: 'Referer', value: VWORLD_DOMAIN });
    return () => TransformRequestManager.removeHeader(id);
  }, []);

  // OpenFreeMap 스타일을 받아 지명만 한글로 바꿔 쓴다
  useEffect(() => {
    fetch(OPENFREEMAP_STYLE)
      .then((r) => r.json())
      .then((st: StyleSpecification) => setFreeStyle(koreanLabels(st)))
      .catch(() => setFreeStyle(null));
  }, []);
  const mapStyle = base === 'OpenFreeMap' && freeStyle ? freeStyle : EMPTY_STYLE;

  // 지도가 멈출 때마다 화면 범위로 마커를 다시 받는다. 이전 요청은 취소
  useEffect(() => {
    if (source !== 'server' || !view) return;
    const ctrl = new AbortController();
    fetchMarkers({ bbox: view.bounds, mapLibreZoom: view.zoom, propertyType }, ctrl.signal)
      .then((r) => { setApi(r); setApiError(null); })
      .catch((e) => { if (!ctrl.signal.aborted) setApiError(`${e.message} (${API_BASE})`); });
    return () => ctrl.abort();
  }, [source, view, propertyType]);

  const spots = useMemo(() => makeSpots(count), [count]);
  const spotsGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features:
        source === 'server'
          ? (api?.markers ?? []).map((m) => ({
              type: 'Feature',
              id: markerId(m),
              // 지역 집계는 검정, 단지는 유형 색, 토지·필지는 초록
              properties: { label: markerLabel(m), color: m.kind === 'region' ? C.ink2 : propertyType === 'land' || m.kind === 'parcel' ? C.land : C.apartment },
              geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
            }))
          : spots.map((p) => ({
              type: 'Feature',
              id: p.id,
              properties: { label: `${p.price}\n${p.area}`, color: C.apartment },
              geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            })),
    }),
    [source, api, spots, propertyType],
  );

  // 마커 개수·방식 변경 → 다음 프레임까지 걸린 시간(JS 기준, 대략치)
  useEffect(() => {
    requestAnimationFrame(() => setRenderMs(Math.round(performance.now() - changedAt.current)));
  }, [count, mode]);

  // JS 스레드 FPS (지도 드래그 중 마커 때문에 JS가 막히는지 보는 용도)
  useEffect(() => {
    let frames = 0, last = performance.now(), id = 0;
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) { setJsFps(frames); frames = 0; last = now; }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  const change = (fn: () => void) => { changedAt.current = performance.now(); fn(); };

  return (
    <View style={styles.root}>
      <Map
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        touchRotate={false}
        touchPitch={false}
        attribution={false}
        logo={false}
        onDidFinishLoadingMap={() => mapRef.current?.getViewState().then((v) => { setZoom(v.zoom); setView(v); })}
        onRegionDidChange={(e) => { setZoom(e.nativeEvent.zoom); setView(e.nativeEvent); }}
        onPress={(e) => setTap(e.nativeEvent.lngLat as [number, number])}
      >
        <Camera ref={cameraRef} initialViewState={{ center: BUSAN, zoom: START_ZOOM }} />

        {base !== 'OpenFreeMap' && (
          <RasterSource key={base} id={`vworld-${base}`} tiles={[wmts(base)]} tileSize={256} minzoom={6} maxzoom={19}>
            <Layer type="raster" id={`vworld-${base}-layer`} />
          </RasterSource>
        )}

        {cadastral && (
          <RasterSource id="cadastral" tiles={[CADASTRAL_WMS]} tileSize={256} minzoom={14} maxzoom={19}>
            <Layer type="raster" id="cadastral-layer" paint={{ 'raster-opacity': 0.9 }} />
          </RasterSource>
        )}

        {tap && (
          <GeoJSONSource id="parcel" data={fakeParcel(tap)}>
            <Layer type="fill" id="parcel-fill" paint={{ 'fill-color': 'rgba(79,122,58,0.24)' }} />
            <Layer type="line" id="parcel-line" paint={{ 'line-color': C.land, 'line-width': 3 }} />
          </GeoJSONSource>
        )}

        {(mode === 'symbol' || source === 'server') && (
          <GeoJSONSource id="spots" data={spotsGeoJSON}>
            <Layer
              type="symbol"
              id="spots-label"
              layout={{
                'text-field': ['get', 'label'],
                'text-font': ['Noto Sans Bold'],
                'text-size': 15,
                'text-line-height': 1.1,
                'text-anchor': 'bottom',
                'text-allow-overlap': false,
              }}
              paint={{ 'text-color': '#FFFFFF', 'text-halo-color': ['get', 'color'], 'text-halo-width': 4 }}
            />
          </GeoJSONSource>
        )}

        {mode === 'view' && source === 'fake' &&
          spots.map((p) => (
            <Marker key={p.id} id={p.id} lngLat={[p.lng, p.lat]} anchor="bottom">
              <ComplexMarkerView price={p.price} area={p.area} />
            </Marker>
          ))}
      </Map>

      <View style={styles.panel} pointerEvents="box-none">
        {!VWORLD_KEY && <Text style={styles.warn}>VWorld 키 없음 → OpenFreeMap 지도 사용 (위성·지적도는 키 필요)</Text>}
        <Row label="데이터">
          <Chip on={source === 'server'} onPress={() => setSource('server')} text="서버" />
          <Chip on={source === 'fake'} onPress={() => setSource('fake')} text="가짜" />
        </Row>
        {source === 'server' ? (
          <Row label="유형">
            {PROPERTY_TYPES.map((p) => (
              <Chip key={p.v} on={propertyType === p.v} onPress={() => setPropertyType(p.v)} text={p.t} />
            ))}
          </Row>
        ) : (
          <>
            <Row label="마커 수">
              {COUNTS.map((n) => (
                <Chip key={n} on={count === n} onPress={() => change(() => setCount(n))} text={String(n)} />
              ))}
            </Row>
            <Row label="방식">
              <Chip on={mode === 'symbol'} onPress={() => change(() => setMode('symbol'))} text="심볼 레이어" />
              <Chip on={mode === 'view'} onPress={() => change(() => setMode('view'))} text="RN 뷰" />
            </Row>
          </>
        )}
        <Row label="지도">
          <Chip on={base === 'OpenFreeMap'} onPress={() => setBase('OpenFreeMap')} text="OSM" />
          {VWORLD_KEY ? (
            <>
              <Chip on={base === 'Base'} onPress={() => setBase('Base')} text="VWorld" />
              <Chip on={base === 'Satellite'} onPress={() => setBase('Satellite')} text="위성" />
              <Chip on={cadastral} onPress={() => setCadastral((v) => !v)} text={`지적도 ${cadastral ? '켜짐' : '꺼짐'}`} />
            </>
          ) : null}
        </Row>
        <Row label="줌">
          <Chip on={false} onPress={() => stepZoom(-1)} text="−" />
          <Chip on={false} onPress={() => stepZoom(1)} text="+" />
          <Chip on={false} onPress={() => cameraRef.current?.zoomTo(16, { duration: 260 })} text="16" />
          <Chip on={false} onPress={() => cameraRef.current?.zoomTo(START_ZOOM, { duration: 260 })} text="시작" />
        </Row>
        <Text style={styles.info}>줌 {zoom.toFixed(2)} (서버 {toServerZoom(zoom)}) · 렌더 {renderMs ?? '-'}ms · JS {jsFps}fps</Text>
        {source === 'server' &&
          (apiError ? (
            <Text style={styles.warn}>서버 오류: {apiError}</Text>
          ) : (
            <Text style={styles.info}>
              {api ? `${api.level} · 마커 ${api.markers.length}개 · ${api.dataMode ?? '?'}` : '불러오는 중…'}
            </Text>
          ))}
        <Text style={styles.info}>탭 {tap ? `${tap[1].toFixed(5)}, ${tap[0].toFixed(5)}` : '지도를 눌러보세요'}</Text>
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({ on, text, onPress }: { on: boolean; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  panel: {
    position: 'absolute', top: 56, left: 12, right: 12, gap: 6, padding: 10,
    backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 12, borderWidth: 1, borderColor: C.rule,
  },
  warn: { fontSize: 13, color: '#B0506B', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowLabel: { width: 52, fontSize: 14, color: C.ink2, fontWeight: '600' },
  chip: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: C.rule, backgroundColor: '#fff', justifyContent: 'center' },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 15, color: C.ink2 },
  chipTextOn: { color: C.bg, fontWeight: '700' },
  info: { fontSize: 14, color: C.ink2 },
  mk: { alignItems: 'center' },
  mkTop: { backgroundColor: C.apartment, borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingHorizontal: 8, paddingVertical: 2, minWidth: 64, alignItems: 'center' },
  mkPrice: { color: '#fff', fontSize: 15, fontWeight: '700' },
  mkBottom: { backgroundColor: '#fff', borderColor: C.apartment, borderWidth: 1.5, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, minWidth: 64, alignItems: 'center' },
  mkSub: { color: C.ink2, fontSize: 12, fontWeight: '600' },
});
