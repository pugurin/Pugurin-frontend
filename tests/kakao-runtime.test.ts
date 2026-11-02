import { beforeEach, describe, expect, it, vi } from "vitest";
import { webRuntime } from "../src/map/kakaoRuntime";
import { fullState } from "../src/map/bridge";
import type { MapProps } from "../src/map/types";
import type { ComplexMarker } from "../src/api/types";

// 카카오 SDK 대역. 런타임이 부르는 API만 흉내 낸다
function fakeKakao() {
  const listeners: { target: unknown; name: string; fn: (e?: any) => void }[] = [];
  const trigger = (target: unknown, name: string, e?: unknown) =>
    listeners.filter((l) => l.target === target && l.name === name).forEach((l) => l.fn(e));
  class LatLng {
    constructor(public lat: number, public lng: number) {}
    getLat() { return this.lat; }
    getLng() { return this.lng; }
  }
  class LatLngBounds {
    constructor(public sw: LatLng, public ne: LatLng) {}
    getSouthWest() { return this.sw; }
    getNorthEast() { return this.ne; }
  }
  const shapes: any[] = [];
  class Shape {
    map: unknown = null;
    constructor(public options: any) { shapes.push(this); }
    setMap(m: unknown) { this.map = m; }
  }
  class KakaoMap {
    center: LatLng;
    level: number;
    type = "ROADMAP";
    overlays: string[] = [];
    constructor(public el: HTMLElement, o: { center: LatLng; level: number }) {
      this.center = o.center;
      this.level = o.level;
      kakao.lastMap = this;
    }
    getCenter() { return this.center; }
    getLevel() { return this.level; }
    getBounds() {
      const span = 0.01 * 2 ** this.level;
      return new LatLngBounds(
        new LatLng(this.center.lat - span, this.center.lng - span),
        new LatLng(this.center.lat + span, this.center.lng + span),
      );
    }
    setCenter(c: LatLng) { this.center = c; }
    panTo(c: LatLng) { this.center = c; trigger(this, "idle"); }
    setLevel(l: number) { this.level = l; trigger(this, "idle"); }
    setBounds(b: LatLngBounds) {
      this.center = new LatLng((b.sw.lat + b.ne.lat) / 2, (b.sw.lng + b.ne.lng) / 2);
      trigger(this, "idle");
    }
    getProjection() { return { containerPointFromCoords: () => ({ x: 100, y: 100 }) }; }
    getMapTypeId() { return this.type; }
    setMapTypeId(t: string) { this.type = t; }
    addOverlayMapTypeId(t: string) { this.overlays.push(t); }
    removeOverlayMapTypeId(t: string) { this.overlays = this.overlays.filter((x) => x !== t); }
    relayout() {}
  }
  const roadview = { panoId: 1234 as number | null };
  const kakao: any = {
    lastMap: null,
    maps: {
      Map: KakaoMap,
      LatLng,
      LatLngBounds,
      CustomOverlay: Shape,
      Polygon: Shape,
      Polyline: Shape,
      MapTypeId: { ROADMAP: "ROADMAP", HYBRID: "HYBRID", USE_DISTRICT: "USE_DISTRICT" },
      event: { addListener: (target: unknown, name: string, fn: () => void) => listeners.push({ target, name, fn }) },
      load: (cb: () => void) => cb(),
      RoadviewClient: class {
        getNearestPanoId(_p: LatLng, _r: number, cb: (id: number | null) => void) { cb(roadview.panoId); }
      },
      Roadview: class {
        constructor() { kakao.lastRoadview = this; }
        setPanoId() { trigger(this, "init"); }
        relayout() {}
      },
    },
  };
  return { kakao, trigger, shapes, roadview };
}

const complex: ComplexMarker = {
  kind: "complex",
  complex_id: "c1",
  name: "해운대아이파크",
  lat: 35.15,
  lng: 129.14,
  transaction_count: 21,
  latest: { deal_type: "sale", price: 1450000000, exclusive_area_pyeong: 25.7, supply_area_pyeong: 34, contract_date: "2026-08-14" },
};
const props = (p: Partial<MapProps> = {}): MapProps => ({
  markers: [complex],
  property: "apartment",
  selected: null,
  unit: "평",
  base: "normal",
  cadastral: false,
  initial: { lat: 35.16, lng: 129.06, zoom: 11, bbox: [128.8, 35, 129.3, 35.4] },
  onEvent: () => {},
  ...p,
});

let fake: ReturnType<typeof fakeKakao>;
beforeEach(() => {
  fake = fakeKakao();
  (globalThis as any).kakao = fake.kakao;
  document.body.innerHTML = '<div id="map"></div>';
});

function start(key = "test-key", p = props()) {
  const events: any[] = [];
  const receive = webRuntime().map(
    document.getElementById("map")!,
    { key, lat: p.initial.lat, lng: p.initial.lng, zoom: p.initial.zoom },
    (m) => events.push(m),
  );
  receive(fullState(p));
  return { events, receive, map: fake.kakao.lastMap };
}

describe("카카오 지도 런타임", () => {
  it("키가 없으면 지도 대신 키 설정 오류를 보낸다", () => {
    const { events } = start("");
    expect(events).toEqual([{ type: "error", message: expect.stringContaining("EXPO_PUBLIC_KAKAO_JS_KEY") }]);
  });

  it("화면 줌을 카카오 레벨로 바꿔 시작하고, 준비되면 카메라를 알린다", () => {
    const { events, map } = start();
    expect(map.level).toBe(7);
    expect(events[0]).toEqual({ type: "ready" });
    expect(events[1]).toMatchObject({ type: "camera", lat: 35.16, lng: 129.06, zoom: 11 });
    expect(events[1].bbox).toHaveLength(4);
  });

  it("처음 범위(bbox)가 있으면 화면을 그 범위에 맞춰 시작한다", () => {
    webRuntime().map(
      document.getElementById("map")!,
      { key: "test-key", lat: 35, lng: 129, zoom: 6.3, bbox: [124, 32, 132, 40] },
      () => {},
    );
    expect(fake.kakao.lastMap.center).toMatchObject({ lat: 36, lng: 128 });
  });

  it("마커를 누르면 marker만 보내고 지도 클릭으로 처리하지 않는다", async () => {
    const { events, map } = start();
    const button: HTMLButtonElement = fake.shapes.find((s) => s.map && s.options.content.classList?.contains("pg-marker")).options.content;
    expect(button.textContent).toContain("14.5억");
    button.click();
    fake.trigger(map, "click", { latLng: new fake.kakao.maps.LatLng(35.15, 129.14) });
    await new Promise((r) => setTimeout(r, 10));
    expect(events.filter((e) => e.type === "marker")).toEqual([{ type: "marker", id: "c1" }]);
    expect(events.some((e) => e.type === "mapClick")).toBe(false);
  });

  it("빈 곳을 누르면 누른 좌표로 mapClick을 보낸다", async () => {
    const { events, map } = start();
    fake.trigger(map, "click", { latLng: new fake.kakao.maps.LatLng(35.2, 129.1) });
    await new Promise((r) => setTimeout(r, 10));
    expect(events.at(-1)).toEqual({ type: "mapClick", lat: 35.2, lng: 129.1 });
  });

  it("위성 지도와 지적도를 켜고 끈다", () => {
    const { receive, map } = start();
    receive({ type: "state", base: "satellite", cadastral: true });
    expect(map.type).toBe("HYBRID");
    expect(map.overlays).toEqual(["USE_DISTRICT"]);
    receive({ type: "state", base: "normal", cadastral: false });
    expect(map.type).toBe("ROADMAP");
    expect(map.overlays).toEqual([]);
  });

  it("필지 경계는 녹색 다각형, 내 위치는 파란 점으로 그린다", () => {
    start(
      "test-key",
      props({
        selectionPoint: { lat: 35.16, lng: 129.16 },
        parcelGeometry: { type: "Polygon", coordinates: [[[129.16, 35.16], [129.17, 35.16], [129.17, 35.17], [129.16, 35.16]]] },
        userLocation: { lat: 35.1, lng: 129.0 },
      }),
    );
    const live = fake.shapes.filter((s) => s.map);
    const polygon = live.find((s) => s.options.path);
    expect(polygon.options).toMatchObject({ strokeColor: "#3f9a3a", fillOpacity: 0.1 });
    expect(polygon.options.path[0][1]).toMatchObject({ lat: 35.16, lng: 129.17 });
    const user = live.find((s) => s.options.zIndex === 200);
    expect(user.options.content.innerHTML).toContain("rgb(26, 115, 232)");
  });

  it("이동·확대 명령을 카카오 레벨로 바꿔 적용한다", () => {
    const { receive, map, events } = start();
    receive({ type: "move", lat: 35.2, lng: 129.2, zoom: 15 });
    expect(map.level).toBe(3);
    expect(map.center).toMatchObject({ lat: 35.2, lng: 129.2 });
    receive({ type: "zoom", delta: -1 });
    expect(map.level).toBe(4);
    expect(events.at(-1)).toMatchObject({ type: "camera", zoom: 14 });
  });

  it("지도가 준비되기 전에 온 이동 명령은 준비된 뒤 적용한다", () => {
    const load = fake.kakao.maps.load;
    let ready = () => {};
    fake.kakao.maps.load = (cb: () => void) => (ready = () => load(cb));
    // SDK가 아직 없다고 보고 스크립트를 붙이게 한다
    const Map = fake.kakao.maps.Map;
    delete fake.kakao.maps.Map;
    const { receive } = start();
    receive({ type: "move", lat: 35.3, lng: 129.3, zoom: 15 });
    const script = document.querySelector<HTMLScriptElement>('script[src*="dapi.kakao.com"]')!;
    expect(script.src).toContain("autoload=false");
    fake.kakao.maps.Map = Map;
    script.onload!(new Event("load"));
    ready();
    expect(fake.kakao.lastMap.level).toBe(3);
    expect(fake.kakao.lastMap.center).toMatchObject({ lat: 35.3, lng: 129.3 });
  });
});

describe("로드뷰 런타임", () => {
  const roadview = () => {
    const status = vi.fn();
    webRuntime().roadview(
      document.getElementById("map")!,
      { key: "test-key", lat: 35.15, lng: 129.14, radius: 100 },
      (m) => status(m.status),
    );
    return status;
  };
  it("근처 로드뷰가 있으면 띄우고 ready를 보낸다", () => {
    expect(roadview()).toHaveBeenCalledWith("ready");
  });
  it("근처에 로드뷰가 없으면 none을 보낸다", () => {
    fake.roadview.panoId = null;
    const status = roadview();
    expect(status).toHaveBeenCalledWith("none");
    expect(fake.kakao.lastRoadview).toBeUndefined();
  });
});
