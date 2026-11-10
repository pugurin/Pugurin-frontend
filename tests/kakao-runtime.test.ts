import { beforeEach, describe, expect, it, vi } from "vitest";
import { webRuntime } from "../src/map/kakaoRuntime";
import { fullState, markerState } from "../src/map/bridge";
import type { MapProps } from "../src/map/types";
import type { Auction, ComplexMarker, School } from "../src/api/types";

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
      Circle: Shape,
      MapTypeId: { ROADMAP: "ROADMAP", HYBRID: "HYBRID", USE_DISTRICT: "USE_DISTRICT", ROADVIEW: "ROADVIEW" },
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

  it("로드뷰 모드에서는 로드뷰가 있는 길 레이어를 지적도와 따로 켜고 끈다", () => {
    const { receive, map } = start();
    receive({ type: "state", cadastral: true, roadview: true });
    expect(map.overlays).toEqual(["USE_DISTRICT", "ROADVIEW"]);
    receive({ type: "state", cadastral: true, roadview: false });
    expect(map.overlays).toEqual(["USE_DISTRICT"]);
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

const auction: Auction = {
  id: "a1",
  source: "court",
  case_no: "2026타경1234",
  court_name: null,
  title: null,
  usage: "아파트",
  property_group: "apartment",
  address: "부산광역시 해운대구 우동 1",
  lat: 35.15,
  lng: 129.14,
  location_precise: true,
  complex_id: "c1",
  appraisal_price: 520000000,
  min_price: 360000000,
  min_price_ratio: 69,
  deposit: null,
  fail_count: null,
  sale_date: "2026-11-14",
  bid_start_at: null,
  bid_end_at: null,
  land_area_m2: null,
  land_area_pyeong: null,
  building_area_m2: null,
  building_area_pyeong: null,
  is_share: false,
  status: null,
  is_closed: false,
};

describe("경매 마커", () => {
  const live = () => fake.shapes.filter((s) => s.map && s.options.content?.classList?.contains("pg-marker"));
  // 점으로 줄어든 경매는 auction 클래스가 빠지므로 접근성 이름으로도 찾는다
  const auctionOverlay = () =>
    live().find(
      (s) => s.options.content.classList.contains("auction") || s.options.content.getAttribute("aria-label") === "경매 물건 보기",
    )!;

  it("단지 마커가 있는 경매는 따로 그리지 않고 단지 마커 모서리에 ⚖ 배지로 붙는다", () => {
    const { events } = start("test-key", props({ auctions: [auction] }));
    expect(live()).toHaveLength(1);
    const host: HTMLButtonElement = live()[0].options.content;
    expect(host.classList.contains("dot")).toBe(false);
    const tag = host.querySelector(".pg-tag") as HTMLElement;
    expect(tag.textContent).toBe("⚖1");
    expect(tag.getAttribute("aria-label")).toBe("경매 1건 보기");
    // 배지를 누르면 단지가 아니라 그 경매를 연다
    tag.click();
    expect(events.filter((e) => e.type === "marker")).toEqual([{ type: "marker", id: "auction:a1" }]);
  });

  it("경매 좌표가 단지와 조금 달라도 단지 마커에 배지로 붙는다", () => {
    start("test-key", props({ auctions: [{ ...auction, lat: 35.1503, lng: 129.1404 }] }));
    expect(live()).toHaveLength(1);
    expect(live()[0].options.content.querySelector(".pg-tag")).not.toBeNull();
  });

  it("단지 마커가 점이면 경매 배지도 그리지 않는다", () => {
    start("test-key", props({
      markers: [{ ...complex, complex_id: "c0", transaction_count: 9 }, complex],
      auctions: [auction],
    }));
    const host = live().find((s) => s.options.content.classList.contains("dot"))!;
    expect(host).toBeTruthy();
    expect(host.options.content.querySelector(".pg-tag")).toBeNull();
    expect(document.querySelectorAll(".pg-tag")).toHaveLength(0);
    expect(live()).toHaveLength(2);
  });

  it("꼬리 있는 마커는 꼬리 끝(상자 아래 7px)을 좌표에 맞춘다", () => {
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(40);
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(20);
    try {
      start("test-key", props({ markers: [], auctions: [{ ...auction, complex_id: null }] }));
      expect(auctionOverlay().options).toMatchObject({ xAnchor: 0.5, yAnchor: 27 / 20 });
    } finally {
      width.mockRestore();
      height.mockRestore();
    }
  });

  it("단지 마커가 없는 경매는 자기 좌표에 가운데 정렬로 그린다", () => {
    start("test-key", props({ markers: [], auctions: [{ ...auction, complex_id: null }] }));
    const a = auctionOverlay();
    expect(a.options.content.className).toBe("pg-marker auction");
    expect(a.options).toMatchObject({ xAnchor: 0.5, yAnchor: 1 });
  });

  it("단지와 이어지지 않은 경매가 같은 자리에 겹치면 점으로 줄어든다", () => {
    start("test-key", props({ auctions: [{ ...auction, complex_id: null }] }));
    expect(auctionOverlay().options.content.className).toBe("pg-marker dot");
  });

  it("점으로 줄어든 경매를 누르면 확대하지 않고 marker를 보낸다", () => {
    const { events, map } = start("test-key", props({ auctions: [{ ...auction, complex_id: null }] }));
    const setLevel = vi.spyOn(map, "setLevel");
    auctionOverlay().options.content.click();
    expect(setLevel).not.toHaveBeenCalled();
    expect(events.filter((e) => e.type === "marker")).toEqual([{ type: "marker", id: "auction:a1" }]);
  });

  it("점으로 줄어든 실거래는 지금처럼 확대한다", () => {
    const { events, map } = start("test-key", props({ markers: [complex, { ...complex, complex_id: "c2", transaction_count: 1 }] }));
    const setLevel = vi.spyOn(map, "setLevel");
    live().find((s) => s.options.content.classList.contains("dot"))!.options.content.click();
    expect(setLevel).toHaveBeenCalledWith(6, expect.anything());
    expect(events.some((e) => e.type === "marker")).toBe(false);
  });
});

const school: School = {
  id: "h1",
  name: "해운대여자고등학교",
  kind: "고등학교",
  level: "high",
  foundation: "공립",
  coed: "여",
  address: "부산광역시 해운대구 우동 1",
  lat: 35.15,
  lng: 129.14,
  tel: null,
  homepage: null,
  opened_on: null,
  distance_m: null,
};

describe("학교 마커", () => {
  const live = () => fake.shapes.filter((s) => s.map && s.options.content?.classList?.contains("pg-marker"));
  const schoolOverlay = () => live().find((s) => s.options.content.classList.contains("school"))!;
  const auctionOverlay = () => live().find((s) => s.options.content.classList.contains("auction"))!;
  const complexOverlay = () => live().find((s) => s.options.content.textContent?.includes("14.5억"))!;

  it("학교는 배지 안 도형 글자와 줄인 이름으로 그린다", () => {
    start("test-key", props({ markers: [], schools: [school] }));
    const o = schoolOverlay();
    const button: HTMLButtonElement = o.options.content;
    expect(button.className).toBe("pg-marker school lv-high");
    const badge = button.firstElementChild!;
    expect(badge.className).toBe("badge");
    const shape = badge.firstElementChild!;
    expect(shape.classList.contains("shape")).toBe(true);
    expect(shape.classList.contains("diamond")).toBe(true);
    expect(shape.textContent).toBe("고");
    expect(button.querySelector(".name")!.textContent).toBe("해운대여고");
    expect(button.style.getPropertyValue("--color")).toBe("#5B3FA0");
  });

  it("학교는 칸 가운데가 아니라 도형 배지 가운데(왼쪽에서 14.5px)를 좌표에 맞춘다", () => {
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(80);
    try {
      start("test-key", props({ markers: [], schools: [school] }));
      expect(schoolOverlay().options).toMatchObject({ xAnchor: 14.5 / 80, yAnchor: 0.5 });
    } finally {
      width.mockRestore();
    }
  });

  it("학교 겹침 판정도 배지 가운데 기준 자리로 한다", () => {
    // 단지 마커(40×20, 꼬리)는 x 80~120에 놓인다. 학교(80×20)를 x 150에 두면
    // 칸 가운데 기준(110~190)이면 겹치지만, 배지 기준(135.5~215.5)이면 겹치지 않는다
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("school") ? 80 : 40;
    });
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(20);
    try {
      const p = props({ schools: [{ ...school, lng: 129.2 }] });
      const { receive, map } = start("test-key", p);
      map.getProjection = () => ({
        containerPointFromCoords: (c: { lng: number }) => ({ x: c.lng === 129.2 ? 150 : 100, y: 100 }),
      });
      receive(markerState(p));
      expect(schoolOverlay().options.content.className).toBe("pg-marker school lv-high");
    } finally {
      width.mockRestore();
      height.mockRestore();
    }
  });

  it("실거래(경매 배지)·학교가 같은 자리에 있으면 학교만 이름 없는 작은 배지가 된다", () => {
    start("test-key", props({ auctions: [auction], schools: [school] }));
    expect(live()).toHaveLength(2);
    const o = schoolOverlay();
    const button: HTMLButtonElement = o.options.content;
    expect(button.className).toBe("pg-marker school lv-high compact");
    expect(button.querySelector(".shape.diamond")!.textContent).toBe("고");
    expect(button.querySelector(".name")).toBeNull();
    expect(button.getAttribute("aria-label")).toBe("해운대여고 학교 보기");
    // 작은 배지는 가운데를 좌표에 두고, 가격 마커 위에 그려 가려지지 않게 한다
    expect(o.options).toMatchObject({ xAnchor: 0.5, yAnchor: 0.5, zIndex: 11 });
    expect(complexOverlay().options.content.classList.contains("dot")).toBe(false);
    expect(complexOverlay().options.content.querySelector(".pg-tag")).not.toBeNull();
  });

  it("경매 배지는 겹침 계산에 넣지 않아 단지 옆 학교를 줄이지 않는다", () => {
    // 마커 크기를 40×20으로 두고, 학교를 단지 오른쪽 끝(120px) 바로 너머에 둔다
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(40);
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(20);
    try {
      const p = props({ auctions: [auction], schools: [{ ...school, lng: 129.2 }] });
      const { receive, map } = start("test-key", p);
      map.getProjection = () => ({
        containerPointFromCoords: (c: { lng: number }) => ({ x: c.lng === 129.2 ? 144 : 100, y: 100 }),
      });
      receive(markerState(p));
      expect(complexOverlay().options.content.querySelector(".pg-tag")).not.toBeNull();
      expect(schoolOverlay().options.content.className).toBe("pg-marker school lv-high");
    } finally {
      width.mockRestore();
      height.mockRestore();
    }
  });

  it("작은 배지가 된 학교를 누르면 확대하지 않고 marker를 보낸다", () => {
    const { events, map } = start("test-key", props({ auctions: [auction], schools: [school] }));
    const setLevel = vi.spyOn(map, "setLevel");
    const button: HTMLButtonElement = schoolOverlay().options.content;
    expect(button.classList.contains("compact")).toBe(true);
    button.click();
    expect(setLevel).not.toHaveBeenCalled();
    expect(events.filter((e) => e.type === "marker")).toEqual([{ type: "marker", id: "school:h1" }]);
  });
});

describe("병원 원", () => {
  const areas = [
    { id: "hospital-area:a", lat: 35.15, lng: 129.14, radius_m: 120, members: [{}, {}, {}] },
    { id: "hospital-area:b", lat: 35.16, lng: 129.15, radius_m: 80, members: [{}] },
  ] as any;
  const circles = () => fake.shapes.filter((s) => s.map && s.options.radius != null);
  const labels = () => fake.shapes.filter((s) => s.map && s.options.content?.classList?.contains("pg-area"));

  it("원마다 Circle과 개수 라벨을 그린다", () => {
    start("test-key", props({ hospitalAreas: areas }));
    expect(circles()).toHaveLength(2);
    expect(circles()[0].options).toMatchObject({
      radius: 120,
      fillColor: "#0E7FA8",
      fillOpacity: 0.12,
      strokeColor: "#0E7FA8",
      strokeWeight: 1,
      strokeOpacity: 0.5,
      zIndex: 1,
    });
    expect(circles()[0].options.center).toMatchObject({ lat: 35.15, lng: 129.14 });
    expect(labels()).toHaveLength(2);
    expect(labels()[0].options.zIndex).toBe(4);
    expect(labels()[0].options.content.textContent).toBe("병원 3");
    expect(labels()[0].options.content.getAttribute("aria-label")).toBe("병원 3곳 보기");
  });

  it("라벨을 누르면 marker만 보내고 지도 클릭으로 처리하지 않는다", async () => {
    const { events, map } = start("test-key", props({ hospitalAreas: areas }));
    labels()[1].options.content.click();
    fake.trigger(map, "click", { latLng: new fake.kakao.maps.LatLng(35.16, 129.15) });
    await new Promise((r) => setTimeout(r, 10));
    expect(events.filter((e) => e.type === "marker")).toEqual([{ type: "marker", id: "hospital-area:b" }]);
    expect(events.some((e) => e.type === "mapClick")).toBe(false);
  });

  it("빈 배열을 받으면 이전 원을 지운다", () => {
    const { receive } = start("test-key", props({ hospitalAreas: areas }));
    expect(circles()).toHaveLength(2);
    expect(labels()).toHaveLength(2);
    receive(fullState(props({ hospitalAreas: [] })));
    expect(circles()).toHaveLength(0);
    expect(labels()).toHaveLength(0);
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
