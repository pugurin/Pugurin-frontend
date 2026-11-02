// 카카오 지도·로드뷰 런타임. 웹은 페이지에서 바로, 앱은 WebView 안에서 같은 코드를 실행한다.
// 앱 WebView에 문자열로 넣어야 해서 일반 JS 문자열로 둔다 (백틱과 "${"는 쓰지 않는다)
import { USER_LOCATION_COLOR } from "./userLocation";
import { SELECTION_COLOR } from "./selection";

export const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? "";
export const HAS_KAKAO = KAKAO_KEY.length > 0;
// 앱 WebView 문서의 주소. 카카오 개발자 콘솔의 JavaScript SDK 도메인에 등록한 https 주소여야 지도가 뜬다
export const KAKAO_APP_URL =
  process.env.EXPO_PUBLIC_KAKAO_APP_URL || "https://localhost";
export const ROADVIEW_RADIUS = 100;

// bbox가 있으면 처음 화면을 그 범위에 맞춘다 (화면 폭과 상관없이 전국이 들어오게)
export type KakaoMapConfig = { key: string; lat: number; lng: number; zoom: number; bbox?: number[] };
export type RoadviewConfig = { key: string; lat: number; lng: number; radius: number };
export type RoadviewStatus = "ready" | "none" | "error";

export const KAKAO_RUNTIME = String.raw`(function () {
if (window.pugurinKakaoMap) return;
var SDK_ERROR = '카카오 지도를 불러올 수 없어요. 네트워크와 지도 키의 등록 도메인을 확인해 주세요.';
var NO_KEY = '카카오 지도 키(EXPO_PUBLIC_KAKAO_JS_KEY)가 설정되지 않았어요.';
var SELECTION_COLOR = ${JSON.stringify(SELECTION_COLOR)};
var USER_COLOR = ${JSON.stringify(USER_LOCATION_COLOR)};
var waiting = null;

// SDK는 한 번만 넣고, 동시에 부른 쪽은 같은 결과를 기다린다
function loadSdk(key, done, fail) {
  if (!key) return fail(NO_KEY);
  if (window.kakao && kakao.maps && kakao.maps.Map) return done();
  if (waiting) return waiting.push([done, fail]);
  waiting = [[done, fail]];
  function finish(error) {
    var list = waiting || [];
    waiting = null;
    clearTimeout(timer);
    list.forEach(function (w) { error ? w[1](error) : w[0](); });
  }
  var timer = setTimeout(function () { finish(SDK_ERROR); }, 12000);
  var script = document.createElement('script');
  script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' + encodeURIComponent(key);
  script.onerror = function () { script.remove(); finish(SDK_ERROR); };
  script.onload = function () {
    try { kakao.maps.load(function () { finish(); }); } catch (e) { finish(SDK_ERROR); }
  };
  document.head.appendChild(script);
}

function addStyle() {
  if (document.getElementById('pugurin-map-style')) return;
  var style = document.createElement('style');
  style.id = 'pugurin-map-style';
  style.textContent =
    '.pg-marker{position:relative;border-radius:10px;border:1.5px solid var(--color);padding:0;background:#fff;box-shadow:0 2px 5px #0003;white-space:nowrap;cursor:pointer;font:600 13px/1.35 Pretendard,-apple-system,sans-serif;color:#2A2A28;text-align:center}' +
    '.pg-marker .amount{background:var(--color);color:#fff;font-size:14px;font-weight:700;padding:3px 8px;border-radius:8px 8px 0 0}' +
    '.pg-marker .sub{padding:2px 7px 3px;font-size:11px}' +
    '.pg-marker:after{content:"";position:absolute;bottom:-7px;left:calc(50% - 6px);border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid var(--color)}' +
    '.pg-marker.region{border:2px solid #fff;border-radius:12px;background:var(--color);color:#fff;padding:5px 11px 6px}' +
    '.pg-marker.region:after{display:none}.pg-marker.region .amount{padding:1px 0}.pg-marker.region .sub{padding:0}' +
    '.pg-marker.auction{border:2px solid var(--color);background:#fff;color:var(--color)}' +
    '.pg-marker.auction .amount{background:none;color:var(--color)}' +
    '.pg-marker.dot{width:14px;height:14px;border:2px solid #fff;border-radius:50%;background:var(--color);box-shadow:0 1px 3px #0004}.pg-marker.dot:after{display:none}' +
    '.pg-measure{position:absolute;left:0;top:0;visibility:hidden;pointer-events:none}';
  document.head.appendChild(style);
}

function circle(size, color, extra) {
  var d = document.createElement('div');
  d.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;box-sizing:border-box;background:' + color + ';' + (extra || '');
  return d;
}

function paths(coords) {
  return coords.map(function (ring) {
    return ring.map(function (c) { return new kakao.maps.LatLng(c[1], c[0]); });
  });
}

window.pugurinKakaoMap = function (el, config, send) {
  var map = null, destroyed = false, overlays = [], shapes = [], pending = null, markerClick = 0;
  var state = { items: [], base: 'normal', cadastral: false, selection: null, user: null };
  var cadastralOn = false;
  addStyle();

  var toLevel = function (zoom) { return Math.max(1, Math.min(14, Math.round(18 - zoom))); };
  var latLng = function (lat, lng) { return new kakao.maps.LatLng(lat, lng); };

  function camera() {
    var c = map.getCenter(), b = map.getBounds(), sw = b.getSouthWest(), ne = b.getNorthEast();
    send({ type: 'camera', lat: c.getLat(), lng: c.getLng(), zoom: 18 - map.getLevel(), bbox: [sw.getLng(), sw.getLat(), ne.getLng(), ne.getLat()] });
  }

  function markerButton(m) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pg-marker' + (m.region ? ' region' : '') + (m.auction ? ' auction' : '');
    button.style.setProperty('--color', m.color);
    button.setAttribute('aria-label', [m.title, m.amount, m.sub].filter(Boolean).join(' '));
    [[m.title, 'sub'], [m.amount, 'amount'], [m.sub, 'sub']].forEach(function (line) {
      if (!line[0]) return;
      var d = document.createElement('div');
      d.className = line[1];
      d.textContent = line[0];
      button.appendChild(d);
    });
    return button;
  }

  // 마커를 다시 그린다. 겹치는 마커는 rank가 큰 쪽을 점으로 줄인다.
  // 단지 옆에 붙는 경매(attach)는 단지를 먼저 자리 잡은 뒤, 그 오른쪽 끝 +4px, 아래 끝에 맞춰 놓는다
  function renderMarkers() {
    overlays.forEach(function (o) { o.setMap(null); });
    overlays = [];
    if (!map) return;
    var proj = map.getProjection(), w = el.clientWidth, h = el.clientHeight, rects = [], placed = {};
    var measure = document.createElement('div');
    measure.className = 'pg-measure';
    el.appendChild(measure);
    var byRank = function (a, b) { return a.rank - b.rank; };
    var items = state.items.filter(function (m) { return !m.attach; }).sort(byRank)
      .concat(state.items.filter(function (m) { return m.attach; }).sort(byRank));
    items.forEach(function (m) {
      var pos = latLng(m.lat, m.lng), p = proj.containerPointFromCoords(pos);
      if (p.x < -150 || p.x > w + 150 || p.y < -150 || p.y > h + 150) return;
      var button = markerButton(m);
      measure.appendChild(button);
      var bw = button.offsetWidth, bh = button.offsetHeight;
      var r = { left: p.x - bw / 2, right: p.x + bw / 2, top: m.region ? p.y - bh / 2 : p.y - bh - 7, bottom: m.region ? p.y + bh / 2 : p.y };
      // 붙을 단지가 점이 아닌 상태로 그려졌으면 그 오른쪽 옆으로 옮긴다. 단지 위치에서 가로로만 띄운다
      var host = m.attach ? placed[m.attach] : null;
      var gap = 0;
      if (host) {
        gap = (host.right - host.left) / 2 + 4;
        r = { left: host.right + 4, right: host.right + 4 + bw, top: host.bottom - bh - 7, bottom: host.bottom };
      }
      var dot = m.rank > 0 && rects.some(function (a) { return r.left < a.right + 3 && r.right > a.left - 3 && r.top < a.bottom + 3 && r.bottom > a.top - 3; });
      if (dot) {
        button.className = 'pg-marker dot';
        button.replaceChildren();
        button.setAttribute('aria-label', m.auction ? '경매 물건 보기' : (m.title || '마커') + ' 확대');
      } else {
        rects.push(r);
        if (!m.auction) placed[m.id] = r;
      }
      if (host) button.style.marginLeft = gap + 'px';
      button.onclick = function () {
        markerClick = Date.now();
        send({ type: 'hover', id: null });
        if (dot && !m.auction) {
          map.setCenter(pos);
          map.setLevel(Math.max(1, map.getLevel() - 1), { animate: { duration: 260 } });
        } else send({ type: 'marker', id: m.id });
      };
      button.onmouseenter = function (e) {
        var b = el.getBoundingClientRect();
        send({ type: 'hover', id: m.id, x: e.clientX - b.left, y: e.clientY - b.top });
      };
      button.onmouseleave = function () { send({ type: 'hover', id: null }); };
      var o = new kakao.maps.CustomOverlay({ position: pos, content: button, xAnchor: host ? 0 : 0.5, yAnchor: (dot && !host) || m.region ? 0.5 : 1, zIndex: m.rank === 0 ? 100 : dot ? 5 : 10, clickable: true });
      o.setMap(map);
      overlays.push(o);
    });
    measure.remove();
  }

  // 필지 경계·선택 지점·내 위치
  function renderShapes() {
    shapes.forEach(function (s) { s.setMap(null); });
    shapes = [];
    if (!map) return;
    var features = [].concat(state.selection ? state.selection.features : [], state.user ? state.user.features : []);
    features.forEach(function (f) {
      var g = f.geometry, kind = f.properties && f.properties.kind;
      if (g.type === 'Point') {
        var dot = kind === 'user'
          ? circle(44, USER_COLOR + '29', 'display:flex;align-items:center;justify-content:center')
          : circle(20, '#ffffffe6', 'border:3px solid ' + SELECTION_COLOR);
        if (kind === 'user') dot.appendChild(circle(16, USER_COLOR, 'border:3px solid #fff'));
        shapes.push(new kakao.maps.CustomOverlay({ position: latLng(g.coordinates[1], g.coordinates[0]), content: dot, xAnchor: 0.5, yAnchor: 0.5, zIndex: kind === 'user' ? 200 : 3 }));
      }
      var line = { strokeColor: SELECTION_COLOR, strokeWeight: 2.5, strokeOpacity: 1 };
      var polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      polygons.forEach(function (poly) {
        shapes.push(new kakao.maps.Polygon(Object.assign({ path: paths(poly), fillColor: SELECTION_COLOR, fillOpacity: 0.1 }, line)));
      });
      if (g.type === 'LineString') shapes.push(new kakao.maps.Polyline(Object.assign({ path: paths([g.coordinates])[0] }, line)));
    });
    shapes.forEach(function (s) { s.setMap(map); });
  }

  function applyLayers() {
    var type = state.base === 'satellite' ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP;
    if (map.getMapTypeId() !== type) map.setMapTypeId(type);
    if (cadastralOn !== !!state.cadastral) {
      if (state.cadastral) map.addOverlayMapTypeId(kakao.maps.MapTypeId.USE_DISTRICT);
      else map.removeOverlayMapTypeId(kakao.maps.MapTypeId.USE_DISTRICT);
      cadastralOn = !!state.cadastral;
    }
  }

  function move(c) {
    if (c.bbox) {
      var b = c.bbox;
      return map.setBounds(new kakao.maps.LatLngBounds(latLng(b[1], b[0]), latLng(b[3], b[2])));
    }
    var center = c.lat != null && c.lng != null ? latLng(c.lat, c.lng) : null;
    var level = c.zoom != null ? toLevel(c.zoom) : map.getLevel();
    if (level !== map.getLevel()) {
      if (center) map.setCenter(center);
      map.setLevel(level, { animate: { duration: 320 } });
    } else if (center) map.panTo(center);
  }

  function receive(m) {
    if (destroyed || !m) return;
    if (m.type === 'state') {
      for (var k in m) if (k !== 'type') state[k] = m[k];
      if (!map) return;
      applyLayers();
      if ('items' in m) renderMarkers();
      if ('selection' in m || 'user' in m) renderShapes();
    } else if (m.type === 'move' || m.type === 'zoom') {
      if (!map) { pending = m; return; }
      if (m.type === 'move') move(m);
      else map.setLevel(Math.max(1, Math.min(14, map.getLevel() - Math.sign(m.delta))), { animate: { duration: 260 } });
    } else if (m.type === 'resize') {
      if (map) { map.relayout(); renderMarkers(); }
    } else if (m.type === 'destroy') {
      destroyed = true;
      overlays.concat(shapes).forEach(function (o) { o.setMap(null); });
    }
  }

  loadSdk(config.key, function () {
    if (destroyed) return;
    map = new kakao.maps.Map(el, { center: latLng(config.lat, config.lng), level: toLevel(config.zoom) });
    if (config.bbox) move({ bbox: config.bbox });
    kakao.maps.event.addListener(map, 'idle', function () { camera(); renderMarkers(); });
    kakao.maps.event.addListener(map, 'dragstart', function () { send({ type: 'hover', id: null }); });
    kakao.maps.event.addListener(map, 'zoom_start', function () { send({ type: 'hover', id: null }); });
    // 마커 클릭이 지도 클릭으로도 전달될 수 있어, 바로 앞에 마커를 눌렀으면 지도 클릭은 버린다
    kakao.maps.event.addListener(map, 'click', function (e) {
      var at = e.latLng;
      setTimeout(function () {
        if (Date.now() - markerClick < 400) return;
        send({ type: 'mapClick', lat: at.getLat(), lng: at.getLng() });
      }, 0);
    });
    applyLayers();
    renderMarkers();
    renderShapes();
    send({ type: 'ready' });
    camera();
    if (pending) { var p = pending; pending = null; receive(p); }
  }, function (message) {
    if (!destroyed) send({ type: 'error', message: message });
  });
  return receive;
};

// 좌표에서 가장 가까운 로드뷰를 띄운다. 반경 안에 없으면 none
window.pugurinKakaoRoadview = function (el, config, send) {
  var destroyed = false, view = null;
  loadSdk(config.key, function () {
    if (destroyed) return;
    var pos = new kakao.maps.LatLng(config.lat, config.lng);
    new kakao.maps.RoadviewClient().getNearestPanoId(pos, config.radius, function (id) {
      if (destroyed) return;
      if (id == null) return send({ type: 'roadview', status: 'none' });
      view = new kakao.maps.Roadview(el);
      kakao.maps.event.addListener(view, 'init', function () { send({ type: 'roadview', status: 'ready' }); });
      view.setPanoId(id, pos);
    });
  }, function () {
    if (!destroyed) send({ type: 'roadview', status: 'error' });
  });
  return function (m) {
    if (m && m.type === 'resize' && view) view.relayout();
    if (m && m.type === 'destroy') destroyed = true;
  };
};
})();`;

// 앱 WebView에 넣을 문서. body 전체를 지도(또는 로드뷰) 영역으로 쓰고 메시지는 ReactNativeWebView로 보낸다
function webViewDocument(start: string, config: object) {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body,#root{height:100%;width:100%;margin:0;overflow:hidden;background:#EDEDE8}</style></head><body><div id="root"></div><script>
${KAKAO_RUNTIME}
(function(){function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
var receive=window.${start}(document.getElementById('root'),${json},send);
window.pugurinReceive=receive;
window.addEventListener('resize',function(){receive({type:'resize'});});
send({type:'boot'});})();
</script></body></html>`;
}

export const kakaoMapDocument = (config: KakaoMapConfig) =>
  webViewDocument("pugurinKakaoMap", config);
export const roadviewDocument = (config: RoadviewConfig) =>
  webViewDocument("pugurinKakaoRoadview", config);

type Receive = (m: unknown) => void;
type Start = (el: HTMLElement, config: object, send: (m: any) => void) => Receive;

// 웹: 런타임을 현재 페이지에 한 번 설치하고 시작 함수를 돌려준다
export function webRuntime(): {
  map: Start;
  roadview: Start;
} {
  const w = window as any;
  if (!w.pugurinKakaoMap) new Function(KAKAO_RUNTIME)();
  return { map: w.pugurinKakaoMap, roadview: w.pugurinKakaoRoadview };
}
