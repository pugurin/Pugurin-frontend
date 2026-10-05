// 부산 실거래가 지도 — 가짜 API
// API 명세서 v0.4 응답 형태를 흉내 냅니다: GET /map/markers, GET /glossary, GET /parcels/lookup, GET /complexes/{id}
// 실제 API로 바꿀 때는 맨 아래 async 함수 안쪽만 fetch('/api/v1/…')로 교체하면 됩니다. 데이터는 모두 가짜입니다.

export const DATA_AS_OF = '2026-10-05T04:00:00+09:00';
const LNG0 = 128.8, LAT0 = 35.4, K = 0.00025;
export const WORLD = { w: 2000, h: 1600 };
export const BUSAN_BOUNDS = { x0: 180, y0: 100, x1: 1960, y1: 1600 };
export const BUSAN_HOME = { x: 1150, y: 820 };
export function toLatLng(x, y) { return { lat: +(LAT0 - y * K).toFixed(6), lng: +(LNG0 + x * K).toFixed(6) }; }
export function toWorld(lat, lng) { return { x: (lng - LNG0) / K, y: (LAT0 - lat) / K }; }
export function zoomToScale(z) { return 0.18 * Math.pow(2, z - 10); }
export function levelForZoom(z) { return z < 12 ? 'sigungu' : z < 14 ? 'dong' : 'complex'; }

export const LAND = [[0,0],[2000,0],[2000,520],[1930,590],[1860,660],[1790,740],[1720,790],[1660,820],[1630,850],[1600,862],[1570,845],[1520,852],[1470,880],[1450,930],[1420,985],[1370,1015],[1320,1045],[1300,1085],[1318,1130],[1290,1180],[1240,1205],[1195,1185],[1150,1160],[1100,1150],[1050,1170],[1000,1195],[960,1240],[930,1275],[880,1295],[830,1305],[800,1350],[740,1345],[700,1395],[640,1440],[580,1425],[520,1395],[470,1430],[420,1470],[340,1480],[280,1520],[200,1500],[0,1460]];
export const ISLANDS = [[[985,1275],[1060,1250],[1120,1295],[1115,1395],[1045,1435],[990,1385]], [[120,1530],[210,1520],[240,1590],[130,1600]]];
export const RIVERS = [
  { w: 64, pts: [[390,-10],[400,300],[430,700],[450,1000],[468,1300],[480,1450]] },
  { w: 36, pts: [[385,300],[300,600],[262,900],[300,1475]] },
  { w: 22, pts: [[1300,420],[1340,560],[1380,700],[1420,800],[1470,870],[1490,885]] }
];

function hash(...a) { let h = 2166136261; for (const v of a) { const s = String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } } return (h >>> 0) / 4294967296; }
function pip(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) c = !c; } return c; }
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
export function isLand(x, y) { const p = [x, y]; if (!(pip(p, LAND) || ISLANDS.some(i => pip(p, i)))) return false; for (const r of RIVERS) for (let i = 1; i < r.pts.length; i++) if (segDist(p, r.pts[i - 1], r.pts[i]) < r.w / 2) return false; return true; }
export function inBusan(x, y) { const b = BUSAN_BOUNDS; return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; }

// 구·군: [코드, 이름, x, y, 아파트 평당(만원·전용), 아파트 12개월 건수, 토지 평당(만원), 토지 건수]
const GU = [
  ['26350','해운대구',1560,700,2850,1204,1450,96], ['26500','수영구',1370,930,3100,862,1900,41],
  ['26230','부산진구',960,880,2300,1310,1600,88], ['26470','연제구',1150,800,2600,742,1500,37],
  ['26260','동래구',1140,610,2500,905,1350,52], ['26290','남구',1210,1080,2200,1022,1250,49],
  ['26410','금정구',1130,360,1700,688,900,73], ['26320','북구',760,520,1500,812,800,64],
  ['26530','사상구',760,800,1400,540,950,58], ['26380','사하구',640,1200,1300,920,850,77],
  ['26440','강서구',260,900,1800,610,520,214], ['26710','기장군',1700,320,1600,980,420,268],
  ['26110','중구',930,1235,1500,120,2400,12], ['26140','서구',830,1200,1700,380,1100,21],
  ['26170','동구',990,1110,1900,410,1300,18], ['26200','영도구',1050,1340,1400,350,900,26]
];
// 동: [구 코드, 이름, x, y, 아파트 평당, 아파트 건수, 토지 평당, 토지 건수]
const DONG = [
  ['26350','우동',1500,800,3200,128,2100,18],['26350','중동',1640,780,3400,214,2300,11],['26350','좌동',1720,720,2500,260,1500,6],['26350','재송동',1440,700,2300,190,1020,14],['26350','반여동',1430,600,1800,240,760,23],['26350','송정동',1840,640,2100,52,1350,24],
  ['26500','남천동',1350,1000,3600,140,2400,9],['26500','광안동',1385,950,3000,260,1900,12],['26500','민락동',1440,905,3300,150,2600,7],['26500','망미동',1315,865,2400,120,1500,8],['26500','수영동',1360,890,2500,90,1700,5],
  ['26230','전포동',1010,920,2700,180,2200,14],['26230','부전동',980,880,2600,150,2600,11],['26230','양정동',1060,840,2300,210,1500,12],['26230','범천동',1000,960,2000,120,1700,9],['26230','개금동',870,880,1700,260,1100,15],['26230','당감동',910,840,1800,190,1200,10],
  ['26470','연산동',1160,800,2600,450,1500,25],['26470','거제동',1100,770,2700,260,1500,12],
  ['26260','온천동',1100,620,2600,320,1500,16],['26260','사직동',1060,680,2700,240,1450,11],['26260','명륜동',1150,575,2500,180,1300,9],['26260','안락동',1230,640,2100,160,1100,13],
  ['26290','대연동',1250,1040,2600,420,1400,17],['26290','용호동',1270,1125,2000,300,1100,14],['26290','문현동',1100,1040,2100,160,1250,9],['26290','감만동',1180,1135,1700,140,1000,8],
  ['26410','장전동',1120,450,1900,240,1000,21],['26410','구서동',1150,380,1800,250,950,26],['26410','부곡동',1120,520,1600,190,800,25],
  ['26320','화명동',620,420,1700,410,900,28],['26320','덕천동',700,580,1400,220,800,18],['26320','만덕동',820,620,1300,180,700,18],
  ['26530','괘법동',720,820,1500,180,1100,22],['26530','주례동',800,880,1400,220,900,18],['26530','엄궁동',690,960,1300,140,850,18],
  ['26380','하단동',590,1170,1500,260,1000,20],['26380','괴정동',680,1130,1300,280,850,19],['26380','다대동',660,1375,1200,220,700,21],['26380','장림동',630,1290,1100,160,800,17],
  ['26440','명지동',415,1300,1900,480,900,38],['26440','대저동',375,700,1300,60,380,92],['26440','강동동',335,1000,1200,30,340,61],['26440','녹산동',200,1350,1400,40,450,23],
  ['26710','기장읍',1820,420,1500,280,520,76],['26710','정관읍',1560,180,1700,480,480,58],['26710','일광읍',1880,300,1600,160,450,71],['26710','장안읍',1820,130,1100,60,300,63],
  ['26110','중앙동',960,1205,1600,60,2600,6],['26110','남포동',915,1250,1400,60,2300,6],
  ['26140','암남동',820,1290,1600,120,900,9],['26140','서대신동',850,1150,1800,260,1200,12],
  ['26170','초량동',970,1120,2000,250,1400,10],['26170','수정동',1000,1070,1800,160,1200,8],
  ['26200','동삼동',1080,1380,1500,200,900,14],['26200','영선동',1010,1300,1300,150,850,12]
];
const GUS = GU.map(([code, name, x, y, ap, ac, lp, lc]) => ({ code, name, x, y, ap, ac, lp, lc }));
const DONGS = DONG.map(([gu, name, x, y, ap, ac, lp, lc], i) => ({ code: gu + String(101 + i).padStart(3, '0') + '00', gu, guName: GUS.find(g => g.code === gu).name, name, x, y, ap, ac, lp, lc, stem: name.replace(/(동|읍)$/, '') }));

// 이름 있는 단지: [이름, 공급평(없으면 null), 전용평, 준공, 세대수, 매매가(억), 층]
const NAMED = {
  '우동': [['해운대아이파크',34,25.7,2011,1631,14.5,21],['해운대두산위브더제니스',41,31,2011,2700,12.8,33],['경동제이드',null,25.7,2006,250,8.2,7],['우동현대',32,24.2,1986,456,4.3,5],['해운대자이1차',34,25.7,2013,520,9.6,18],['센텀파크1차',35,26.5,2005,1192,7.4,12]],
  '중동': [['해운대엘시티더샵',65,49.1,2019,882,32,61],['해운대롯데캐슬스타',34,25.7,2018,744,9.9,28],['중동대림',32,24.2,1998,610,5.1,9]],
  '좌동': [['해운대신도시대우',32,24.2,1997,1088,5.4,11],['좌동경남',32,24.2,1996,840,4.9,6],['좌동벽산',24,18.1,1996,700,3.6,8]],
  '남천동': [['남천삼익비치',33,25,1979,3060,11.2,9],['남천자이',34,25.7,2022,440,13.1,15],['남천코오롱하늘채',34,25.7,2018,500,10.8,20]],
  '광안동': [['광안자이',34,25.7,2020,1100,9.4,14],['광안협성',32,24.2,2003,380,5.2,7],['광안쌍용예가',34,25.7,2009,620,6.9,12]],
  '민락동': [['민락롯데캐슬',45,34,2016,1050,11.9,25],['민락비치',32,24.2,1995,300,5.8,6]],
  '전포동': [['서면아이파크',34,25.7,2019,1360,8.6,19],['전포삼한',32,24.2,2001,420,4.6,8]],
  '부전동': [['서면센트럴자이',34,25.7,2020,1100,9.1,22]],
  '연산동': [['연산롯데캐슬',34,25.7,2017,1510,7.3,16],['연산힐스테이트',34,25.7,2016,900,7.0,11],['연산현대',32,24.2,1992,820,3.9,4]],
  '대연동': [['대연롯데캐슬레전드',34,25.7,2017,3149,8.4,24],['대연힐스테이트푸르지오',34,25.7,2013,2366,7.6,15]],
  '명지동': [['명지더샵퍼스트월드',34,25.7,2012,2900,5.8,17],['명지호반베르디움',34,25.7,2013,1200,5.2,10]]
};
const BRANDS = ['푸르지오','래미안','e편한세상','롯데캐슬','자이','더샵','힐스테이트','SK뷰','삼익','현대','대우','협성','한신','동원로얄듀크'];
const OT = ['센텀오피스텔','시티타워','스카이뷰','더테라스'];
const VL = ['그린빌라','하이츠','빌리지','맨션','하우스'];
const pad = n => String(n).padStart(2, '0');
const r1 = v => Math.round(v * 10) / 10;

function near(d, i, kind, rad) {
  for (let k = 0; k < 6; k++) {
    const a = hash(d.code, kind, i, k) * Math.PI * 2, r = (0.35 + 0.65 * hash(d.code, kind, i, 'r', k)) * rad;
    const x = d.x + Math.cos(a) * r, y = d.y + Math.sin(a) * r;
    if (isLand(x, y)) return { x, y };
  }
  return { x: d.x, y: d.y };
}
function dateIn(seed, months) { const m = 9 - Math.floor(hash(seed, 'm') * Math.min(3, months)); return `2026-${pad(m)}-${pad(1 + Math.floor(hash(seed, 'd') * 27))}`; }

const COMPLEXES = [];
DONGS.forEach(d => {
  const named = NAMED[d.name] || [];
  const nAuto = named.length ? 0 : Math.max(2, Math.min(6, Math.round(d.ac / 70)));
  const apts = named.slice();
  for (let i = 0; i < nAuto; i++) {
    const sup = [32, 34, 34, 24, 45][Math.floor(hash(d.code, 'sup', i) * 5)], ex = r1(sup * 0.756);
    const eok = r1(d.ap * ex / 10000 * (0.85 + 0.3 * hash(d.code, 'p', i)));
    apts.push([d.stem + BRANDS[Math.floor(hash(d.code, 'b', i) * BRANDS.length)], sup, ex, 1988 + Math.floor(hash(d.code, 'y', i) * 35), 200 + Math.floor(hash(d.code, 'h', i) * 1600), eok, 2 + Math.floor(hash(d.code, 'f', i) * 22)]);
  }
  apts.forEach((a, i) => {
    const p = near(d, i, 'apt', 46);
    COMPLEXES.push({ complex_id: `c-${d.code}-a${i}`, property_type: 'apartment', name: a[0], dong: d, x: p.x, y: p.y, supply: a[1], exclusive: a[2], build_year: a[3], household_count: a[4], sale: Math.round(a[5] * 1e8), floor: a[6], c12: 4 + Math.floor(hash(d.code, 'c', i) * 26) });
  });
  if (d.ap >= 2300) for (let i = 0; i < 1 + Math.floor(hash(d.code, 'otn') * 3); i++) {
    const p = near(d, i, 'ot', 40), ex = r1(8 + hash(d.code, 'oe', i) * 16);
    COMPLEXES.push({ complex_id: `c-${d.code}-o${i}`, property_type: 'officetel', name: d.stem + ' ' + OT[i % OT.length], dong: d, x: p.x, y: p.y, supply: null, exclusive: ex, build_year: 2008 + Math.floor(hash(d.code, 'oy', i) * 17), household_count: 120 + Math.floor(hash(d.code, 'oh', i) * 500), sale: Math.round(d.ap * 0.62 * ex * 1e4 * (0.9 + 0.2 * hash(d.code, 'op', i))), floor: 3 + Math.floor(hash(d.code, 'of', i) * 30), c12: 2 + Math.floor(hash(d.code, 'oc', i) * 14) });
  }
  for (let i = 0; i < 2 + Math.floor(hash(d.code, 'vn') * 3); i++) {
    const p = near(d, i, 'vl', 50), ex = r1(11 + hash(d.code, 've', i) * 10);
    COMPLEXES.push({ complex_id: `c-${d.code}-v${i}`, property_type: 'villa', name: d.stem + VL[i % VL.length], dong: d, x: p.x, y: p.y, supply: null, exclusive: ex, build_year: 1995 + Math.floor(hash(d.code, 'vy', i) * 28), household_count: 8 + Math.floor(hash(d.code, 'vh', i) * 30), sale: Math.round(d.ap * 0.45 * ex * 1e4 * (0.85 + 0.3 * hash(d.code, 'vp', i))), floor: 1 + Math.floor(hash(d.code, 'vf', i) * 4), c12: 1 + Math.floor(hash(d.code, 'vc', i) * 8) });
  }
});
COMPLEXES.forEach(c => {
  const seed = c.complex_id;
  c.jeonse = Math.round(c.sale * (0.52 + 0.1 * hash(seed, 'j')) / 1e6) * 1e6;
  c.deposit = c.property_type === 'officetel' ? 1000e4 : c.property_type === 'villa' ? 2000e4 : (3 + Math.floor(hash(seed, 'dp') * 3)) * 1000e4;
  c.rent = Math.round((c.property_type === 'apartment' ? 70 + hash(seed, 'rt') * 70 : c.property_type === 'officetel' ? 50 + hash(seed, 'rt') * 30 : 40 + hash(seed, 'rt') * 25)) * 1e4;
});
const fixed = COMPLEXES.find(c => c.name === '해운대아이파크'); if (fixed) { fixed.jeonse = 5e8; fixed.deposit = 5000e4; fixed.rent = 80e4; fixed.c12 = 24; }

// 공개된 토지 거래(필지 마커) — 지번이 가려진 거래가 많아 동네당 0~2개만 둠
const PARCEL_TRADES = [];
DONGS.forEach(d => {
  const n = d.lc >= 20 ? 2 : hash(d.code, 'pt') < 0.6 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const p = near(d, i, 'pc', 55), area = r1(60 + hash(d.code, 'pa', i) * 360);
    const cat = d.lp < 700 ? ['전', '답', '임야', '대'][Math.floor(hash(d.code, 'pk', i) * 4)] : '대';
    PARCEL_TRADES.push({ pnu: `${d.code}1${String(100 + Math.floor(hash(d.code, 'pj', i) * 800)).padStart(4, '0')}0000`, dong: d, x: p.x, y: p.y, address: `${d.guName} ${d.name} ${100 + Math.floor(hash(d.code, 'pj', i) * 800)}`, land_category: cat, land_area_pyeong: area, price: Math.round(d.lp * area * (0.8 + 0.45 * hash(d.code, 'pp', i))) * 1e4, contract_date: dateIn(d.code + 'p' + i, 3) });
  }
});
const pt0 = PARCEL_TRADES.find(p => p.dong.name === '일광읍'); if (pt0) Object.assign(pt0, { land_category: '전', land_area_pyeong: 120.5, price: 3.8e8, contract_date: '2026-07-18' });

const scaleCount = (n, months, seed) => Math.floor(n * months / 12 * (0.85 + 0.3 * hash(seed, months)) + (months >= 12 ? 0.5 : hash(seed, 'cnt')));
function regionSummary(r, ptype, deal, months, isDong) {
  const lvl = isDong ? r : r;
  let cnt, sum = {};
  const tf = { apartment: [1, 1], officetel: [0.62, 0.22], villa: [0.45, 0.35] };
  if (ptype === 'land') { cnt = scaleCount(lvl.lc, months, r.code + 'land'); sum.median_price_per_pyeong = lvl.lp * 1e4; }
  else {
    const [pf, cf] = tf[ptype];
    const df = deal === 'sale' ? 1 : deal === 'jeonse' ? 0.75 : 0.5;
    cnt = scaleCount(lvl.ac * cf * df, months, r.code + ptype + deal);
    const ppp = Math.round(lvl.ap * pf) * 1e4;
    if (deal === 'sale') sum.median_price_per_pyeong = ppp;
    else if (deal === 'jeonse') sum.median_deposit_per_pyeong = Math.round(ppp * 0.56 / 1e5) * 1e5;
    else { sum.median_deposit = (ptype === 'apartment' ? 5000 : ptype === 'officetel' ? 1000 : 2000) * 1e4; sum.median_monthly_rent = Math.round((ptype === 'apartment' ? 80 : ptype === 'officetel' ? 55 : 45) * (lvl.ap / 2600)) * 1e4; }
  }
  if (r.name === '해운대구' && ptype === 'apartment' && deal === 'sale' && months === 12) cnt = 1204;
  if (r.name === '우동' && ptype === 'apartment' && months === 12) { if (deal === 'sale') cnt = 128; if (deal === 'jeonse') { cnt = 96; sum.median_deposit_per_pyeong = 1800e4; } if (deal === 'monthly') { cnt = 54; sum.median_deposit = 5000e4; sum.median_monthly_rent = 80e4; } }
  return { cnt, sum };
}
function latestOf(c, deal, months) {
  const cnt = scaleCount(c.c12 * (deal === 'sale' ? 1 : deal === 'jeonse' ? 0.7 : 0.45), months, c.complex_id + deal);
  if (cnt <= 0) return null;
  const date = c.name === '해운대아이파크' && deal === 'sale' ? '2026-08-14' : dateIn(c.complex_id + deal, months);
  return { cnt, latest: { deal_type: deal, price: deal === 'sale' ? c.sale : null, deposit: deal === 'jeonse' ? c.jeonse : deal === 'monthly' ? c.deposit : null, monthly_rent: deal === 'monthly' ? c.rent : null, exclusive_area_pyeong: c.exclusive, supply_area_pyeong: c.supply, floor: c.floor, contract_date: date } };
}

let MOCK_MODE = null; // null | 'empty' | 'error'
export function setMockMode(m) { MOCK_MODE = m; }

export function getMapMarkersSync({ bbox, zoom, property_type, deal_type = 'sale', period_months = 12 }) {
  const level = levelForZoom(zoom);
  const deal = property_type === 'land' ? 'sale' : deal_type;
  const a = toWorld(bbox[1], bbox[0]), b = toWorld(bbox[3], bbox[2]);
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  const mx = (x1 - x0) * 0.15, my = (y1 - y0) * 0.15;
  const inBox = (x, y) => x >= x0 - mx && x <= x1 + mx && y >= y0 - my && y <= y1 + my;
  const markers = [];
  const region = (r, lvl) => { const { cnt, sum } = regionSummary(r, property_type, deal, period_months, lvl === 'dong'); if (cnt > 0) markers.push({ kind: 'region', level: lvl, region_code: r.code, name: r.name, ...toLatLng(r.x, r.y), transaction_count: cnt, summary: sum }); };
  if (MOCK_MODE !== 'empty') {
    if (level === 'sigungu') GUS.filter(g => inBox(g.x, g.y)).forEach(g => region(g, 'sigungu'));
    else if (level === 'dong' || property_type === 'land') DONGS.filter(d => inBox(d.x, d.y)).forEach(d => region(d, 'dong'));
    if (level === 'complex') {
      if (property_type === 'land') PARCEL_TRADES.filter(p => inBox(p.x, p.y) && (period_months >= 3 || p.contract_date >= '2026-09-05')).forEach(p => markers.push({ kind: 'parcel', pnu: p.pnu, address: p.address, ...toLatLng(p.x, p.y), transaction_count: 1, latest: { deal_type: 'sale', price: p.price, land_area_pyeong: p.land_area_pyeong, land_category: p.land_category, contract_date: p.contract_date } }));
      else COMPLEXES.filter(c => c.property_type === property_type && inBox(c.x, c.y)).forEach(c => { const l = latestOf(c, deal, period_months); if (l) markers.push({ kind: 'complex', complex_id: c.complex_id, name: c.name, property_type: c.property_type, ...toLatLng(c.x, c.y), transaction_count: l.cnt, latest: l.latest }); });
    }
  }
  return { data: { level, markers: markers.slice(0, 500) }, meta: { data_as_of: DATA_AS_OF, reporting_lag_notice: true } };
}

export function getComplexSync(id, deal_type = 'sale') {
  const c = COMPLEXES.find(x => x.complex_id === id); if (!c) return null;
  const tx = [0, 1, 2].map(i => {
    const f = 0.94 + 0.08 * hash(id, 'tx', i);
    const m = [8, 7, 6][i], dd = 3 + Math.floor(hash(id, 'td', i) * 25);
    return { deal_type, price: deal_type === 'sale' ? Math.round(c.sale * (i ? f : 1) / 1e6) * 1e6 : null, deposit: deal_type === 'sale' ? null : Math.round((deal_type === 'jeonse' ? c.jeonse : c.deposit) * (i ? f : 1) / 1e6) * 1e6, monthly_rent: deal_type === 'monthly' ? c.rent : null, exclusive_area_pyeong: c.exclusive, supply_area_pyeong: c.supply, floor: Math.max(1, c.floor + [0, -6, 4][i]), contract_date: i === 0 && c.name === '해운대아이파크' ? '2026-08-14' : `2026-${pad(m)}-${pad(dd)}`, trade_type: hash(id, 'tt', i) < 0.85 ? 'broker' : 'direct' };
  });
  return { complex_id: c.complex_id, name: c.name, property_type: c.property_type, address: `부산광역시 ${c.dong.guName} ${c.dong.name} ${1000 + Math.floor(hash(id, 'addr') * 600)}`, ...toLatLng(c.x, c.y), build_year: c.build_year, household_count: c.household_count, area_types: [{ exclusive_area_pyeong: c.exclusive, supply_area_pyeong: c.supply }], recent_transactions: tx };
}

const ZONES = { r2: ['제2종일반주거지역', 60, 250, '주택과 아파트 위주의 동네예요. 중간 높이 건물까지 지을 수 있어요.'], r3: ['제3종일반주거지역', 50, 300, '중간 높이 이상의 아파트를 지을 수 있는 주거지역이에요.'], c1: ['일반상업지역', 80, 1000, '가게·사무실 같은 상업 건물을 높게 지을 수 있는 곳이에요.'], g1: ['자연녹지지역', 20, 100, '자연을 지키기 위한 곳이라 작은 건물만 지을 수 있어요.'], m1: ['계획관리지역', 40, 100, '도시로 바뀔 수 있게 계획적으로 관리하는 땅이에요.'] };
const RESTR = [['가축사육제한구역', '소·돼지 등 가축을 키우는 시설을 지을 수 없어요.', 'livestock'], ['교육환경보호구역', '학교 근처라 유흥업소 등 일부 시설은 지을 수 없어요.', null], ['대공방어협조구역', '높은 건물을 지을 때 군부대와 협의가 필요해요.', null], ['비행안전구역', '비행기 안전을 위해 건물 높이가 제한돼요.', null], ['자연경관지구', '경치를 지키기 위해 건물 높이와 모양이 제한돼요.', null]];
const zoning = (k, ratio, inclusion) => ({ zone_type: ZONES[k][0], area_ratio: ratio, inclusion, max_building_coverage_ratio: ZONES[k][1], max_floor_area_ratio: ZONES[k][2], easy: ZONES[k][3] });
export function parcelCell(x, y) { const r = Math.floor(y / 4.5), off = (r % 2) * 3, c = Math.floor((x - off) / 6); return { c, r, x0: c * 6 + off, y0: r * 4.5, w: 6, h: 4.5 }; }

export function lookupParcelSync({ lat, lng }) {
  let { x, y } = toWorld(lat, lng); x = Math.round(x * 100) / 100; y = Math.round(y * 100) / 100;
  if (!inBusan(x, y)) return { status: 'out_of_busan', message: '부산 지역만 지원해요' };
  if (!isLand(x, y)) return { status: 'no_parcel', message: '이곳은 토지 정보가 없어요' };
  const cell = parcelCell(x, y);
  let d = DONGS[0], best = 1e9; DONGS.forEach(q => { const dd = Math.hypot(q.x - x, q.y - y); if (dd < best) { best = dd; d = q; } });
  const h = k => hash('parcel', cell.c, cell.r, k);
  const rural = d.lp < 700;
  const main = 1 + Math.floor(h('m') * 1400), sub = Math.floor(h('s') * 40);
  const cat = rural ? ['전', '답', '임야', '대', '대'][Math.floor(h('k') * 5)] : (h('k') < 0.82 ? '대' : h('k') < 0.92 ? '잡종지' : '전');
  const m2 = Math.round(150 + h('a') * 1450);
  let zk = cat === '대' || cat === '잡종지' ? (d.ap >= 2600 && h('z') < 0.35 ? 'c1' : h('z') < 0.6 ? 'r2' : 'r3') : (h('z') < 0.6 ? 'g1' : 'm1');
  let zonings = [zoning(zk, 1, '포함')];
  if (h('mz') < 0.15 && zk !== 'c1') zonings = [zoning(zk, 0.8, '포함'), zoning('c1', 0.2, '저촉')];
  const nR = 1 + Math.floor(h('nr') * 3);
  const restrictions = RESTR.slice().sort((a, b) => hash(cell.c, cell.r, a[0]) - hash(cell.c, cell.r, b[0])).slice(0, nR).map(([name, easy, term_id]) => ({ name, easy, term_id }));
  let p = {
    pnu: `${d.code}1${String(main).padStart(4, '0')}${String(sub).padStart(4, '0')}`, address: `부산광역시 ${d.guName} ${d.name} ${main}${sub ? '-' + sub : ''}`, short_address: `${d.guName} ${d.name} ${main}${sub ? '-' + sub : ''}`,
    land_category: cat, land_area_m2: m2, land_area_pyeong: r1(m2 / 3.3058),
    official_land_price_per_m2: Math.round(d.lp * 1e4 / 3.3058 * (0.55 + 0.2 * h('o')) / 1e4) * 1e4, official_land_price_year: 2026,
    road_side: ['중로한면', '소로한면', '세로(가)', '광대로한면', '맹지'][Math.floor(h('rd') * 5)], shape: ['가로장방형', '세로장방형', '정방형', '사다리형', '부정형'][Math.floor(h('sh') * 5)],
    zonings, ratio_source: '부산광역시 도시계획 조례', restrictions
  };
  const key = cell.c + ',' + cell.r;
  if (key === '225,222') p = Object.assign(p, { pnu: '2650010700101480003', address: '부산광역시 수영구 남천동 148-3', short_address: '수영구 남천동 148-3', land_category: '대', land_area_m2: 1520.7, land_area_pyeong: 460, official_land_price_per_m2: 5120000, road_side: '중로한면', shape: '가로장방형', zonings: [zoning('r2', 1, '포함')], restrictions: [RESTR[0], RESTR[1], RESTR[2]].map(([name, easy, term_id]) => ({ name, easy, term_id })) });
  if (key === '168,204') p = Object.assign(p, { pnu: '2623010100106680012', address: '부산광역시 부산진구 전포동 668-12', short_address: '부산진구 전포동 668-12', land_category: '대', land_area_m2: 694.2, land_area_pyeong: 210, official_land_price_per_m2: 6470000, zonings: [zoning('r2', 0.8, '포함'), zoning('c1', 0.2, '저촉')] });
  const cornersW = [[cell.x0, cell.y0], [cell.x0 + cell.w, cell.y0], [cell.x0 + cell.w, cell.y0 + cell.h], [cell.x0, cell.y0 + cell.h], [cell.x0, cell.y0]];
  p.geometry = { type: 'Polygon', coordinates: [cornersW.map(([wx, wy]) => { const ll = toLatLng(wx, wy); return [ll.lng, ll.lat]; })] };
  p.glossary = { land_category: 'land-category', official_land_price_per_m2: 'official-price', road_side: 'road-side', zone_type: 'zoning', max_building_coverage_ratio: 'bcr', max_floor_area_ratio: 'far' };
  return { status: 'ok', parcel: p };
}

export const GLOSSARY = [
  { term_id: 'far', term: '용적률', category: 'building', is_popular: true, display_order: 10, short_definition: '땅 넓이에 비해 건물을 얼마나 크게 지을 수 있는지 나타낸 비율이에요.', long_definition: '건물 각 층의 바닥 넓이를 모두 더한 값(연면적)을 땅 넓이로 나눈 비율이에요. 용도지역마다 한도가 있고, 부산은 도시계획 조례로 정해요. 한도가 높을수록 같은 땅에 더 크고 높은 건물을 지을 수 있어요.', example: '땅 100평 · 용적률 250% → 연면적 250평까지 지을 수 있어요. 1층을 50평으로 지으면 5층까지예요.' },
  { term_id: 'bcr', term: '건폐율', category: 'building', is_popular: true, display_order: 20, short_definition: '땅 넓이 중에서 건물이 들어설 수 있는 바닥 넓이의 비율이에요.', long_definition: '건물을 위에서 내려다봤을 때 땅을 덮는 넓이(건축면적)를 땅 넓이로 나눈 비율이에요. 나머지 땅은 마당·주차장·통로로 남겨야 해요.', example: '땅 100평 · 건폐율 60% → 건물 바닥은 60평까지, 나머지 40평은 비워 둬요.' },
  { term_id: 'official-price', term: '공시지가', category: 'land', is_popular: true, display_order: 30, short_definition: '나라가 매년 정해서 알려주는 땅값이에요.', long_definition: '국토교통부와 구청이 매년 1월 1일 기준으로 정해 발표하는 땅값이에요. 실제로 사고파는 값(실거래가)과는 달라요. 세금이나 보상금을 정할 때 기준으로 써요.', example: '㎡당 512만 원 → 평당 약 1,692만 원 (1평 = 3.3058㎡)' },
  { term_id: 'land-category', term: '지목', category: 'land', is_popular: true, display_order: 40, short_definition: '땅을 무엇에 쓰는지 나라 장부에 적어 둔 이름이에요.', long_definition: '토지대장에 적힌 땅의 용도예요. 모두 28가지가 있고, 자주 보는 것은 대(집·건물), 전(밭), 답(논), 임야(산)예요. 지목에 따라 건물을 바로 지을 수 있는지가 달라요.', example: '대 = 집이나 건물을 지을 수 있는 땅 · 전 = 밭 · 답 = 논 · 임야 = 산' },
  { term_id: 'zoning', term: '용도지역', category: 'land', is_popular: true, display_order: 50, short_definition: '땅마다 정해진 쓰임새예요. 주거·상업·공업·녹지 등으로 나눠요.', long_definition: '도시를 계획적으로 쓰려고 땅마다 정해 둔 쓰임새예요. 용도지역에 따라 지을 수 있는 건물 종류와 건폐율·용적률 한도가 달라져요.', example: '제2종일반주거지역 → 주택·아파트 위주, 건폐율 60% · 용적률 250% (부산 조례 기준)' },
  { term_id: 'road-side', term: '도로접면', category: 'land', is_popular: false, display_order: 60, short_definition: '땅이 어떤 폭의 도로에, 몇 면이 닿아 있는지 나타내요.', long_definition: '땅이 닿아 있는 도로의 폭과 닿은 면의 수를 줄여 쓴 말이에요. 도로에 닿지 않은 땅(맹지)은 건물을 짓기 어려워요.', example: '중로한면 = 폭 12~25m 도로에 한쪽이 닿아 있음 · 맹지 = 도로에 닿지 않음' },
  { term_id: 'exclusive-area', term: '전용면적', category: 'building', is_popular: true, display_order: 70, short_definition: '우리 집만 쓰는 실제 면적이에요.', long_definition: '현관 안쪽처럼 그 집만 쓰는 공간의 넓이예요. 복도·계단·엘리베이터 같은 공용 부분은 빠져요. 이 앱의 평당가와 면적 필터는 전용면적 기준이에요.', example: '공급 34평 아파트의 전용면적은 보통 25.7평(84.97㎡)이에요.' },
  { term_id: 'supply-area', term: '공급면적', category: 'building', is_popular: false, display_order: 80, short_definition: '전용면적에 복도·계단 같은 공용 부분을 더한 면적이에요.', long_definition: '흔히 말하는 "34평 아파트"가 이 기준이에요. 같은 공급면적이라도 단지마다 전용면적은 조금씩 달라요.', example: '전용 25.7평 + 공용 8.3평 = 공급 34평' },
  { term_id: 'actual-price', term: '실거래가', category: 'trade', is_popular: true, display_order: 90, short_definition: '실제로 사고판 가격을 나라에 신고한 금액이에요.', long_definition: '계약하고 30일 안에 신고한 실제 거래 금액이에요. 국토교통부가 공개하고, 이 앱은 그 자료를 매일 받아와요. 신고 기한 때문에 최근 한 달 거래는 나중에 더 늘어날 수 있어요.', example: '8월 14일 계약 → 9월 13일까지 신고 → 지도에 표시' },
  { term_id: 'cancelled', term: '해제거래', category: 'trade', is_popular: false, display_order: 100, short_definition: '계약했다가 나중에 취소된 거래예요.', long_definition: '실거래가로 신고됐다가 계약이 해제된 거래예요. 시세를 왜곡할 수 있어서 지도와 통계에서는 빼고, 거래 목록에서 따로 켜야 보여요.', example: '8월에 14.8억으로 신고 → 9월에 해제 → 지도와 평균에서 빠짐' },
  { term_id: 'direct', term: '직거래', category: 'trade', is_popular: false, display_order: 110, short_definition: '중개사 없이 사는 사람과 파는 사람이 직접 한 거래예요.', long_definition: '가족·지인 사이 거래가 많아 시세와 다를 수 있어요. 필터에서 직거래를 빼고 볼 수 있어요.', example: '필터 → 직거래 제외 켜기 → 지도에서 직거래가 빠짐' },
  { term_id: 'acquisition-tax', term: '취득세', category: 'tax', is_popular: true, display_order: 120, short_definition: '집이나 땅을 살 때 한 번 내는 세금이에요.', long_definition: '부동산을 산 사람이 잔금을 치른 날부터 60일 안에 내는 세금이에요. 집값, 가진 집 수, 지역에 따라 세율이 달라요. 정확한 금액은 관할 구청에 확인하세요.', example: '1주택자가 6억 원 이하 집을 사면 보통 집값의 1%' },
  { term_id: 'property-tax', term: '재산세', category: 'tax', is_popular: false, display_order: 130, short_definition: '집이나 땅을 가진 사람이 매년 내는 세금이에요.', long_definition: '매년 6월 1일에 주인인 사람에게 나와요. 집은 7월과 9월에 나눠 내요.', example: '6월 1일 기준 주인 → 7월·9월 고지서' },
  { term_id: 'median', term: '중위값', category: 'trade', is_popular: false, display_order: 140, short_definition: '가격을 줄 세웠을 때 딱 가운데 값이에요.', long_definition: '너무 싸거나 비싼 거래 몇 건에 휘둘리지 않도록 평균 대신 써요. 이 앱의 구·동 평당가는 중위값이에요.', example: '5억 · 6억 · 7억 · 8억 · 30억 → 중위값 7억 (평균은 11.2억)' },
  { term_id: 'ppp', term: '평당가', category: 'trade', is_popular: false, display_order: 150, short_definition: '가격을 면적 1평 기준으로 나눈 값이에요.', long_definition: '크기가 다른 집이나 땅끼리 비교할 때 써요. 이 앱은 아파트·오피스텔·빌라는 전용면적, 토지는 토지면적으로 나눠요.', example: '14.5억 ÷ 전용 25.7평 = 평당 약 5,642만 원' },
  { term_id: 'cadastral', term: '지적도', category: 'land', is_popular: false, display_order: 160, short_definition: '땅의 경계와 지번을 그려 놓은 나라 지도예요.', long_definition: '필지마다 경계선과 지번이 그려져 있어요. 지도에서 켜면 땅을 하나씩 눌러 볼 수 있어요.', example: '지도 레이어 → 지적도 켜기' },
  { term_id: 'livestock', term: '가축사육제한구역', category: 'land', is_popular: false, display_order: 170, short_definition: '소·돼지 등 가축을 키우는 시설을 지을 수 없는 곳이에요.', long_definition: '냄새·소음으로 주민 생활이 불편해지지 않도록 구청이 정한 곳이에요. 주거지 가까운 땅은 대부분 여기에 들어가요.', example: '주택가 주변 땅 → 축사 신축 불가' }
];
export const CATEGORY_LABEL = { trade: '거래', land: '토지', building: '건물', tax: '세금' };
export function getGlossarySync({ q = '', category = '' } = {}) {
  const qq = q.trim();
  const list = GLOSSARY.filter(t => (!category || t.category === category) && (!qq || t.term.includes(qq) || t.short_definition.includes(qq))).sort((a, b) => a.display_order - b.display_order || a.term.localeCompare(b.term, 'ko'));
  return { data: list, meta: { etag: '"glossary-20261005"' } };
}

// ---- 화면 표기 도우미 (실제 API로 바꿔도 그대로 씀) ----
export const fmtEok = w => { if (w == null) return ''; if (w >= 1e8) { const v = Math.round(w / 1e7) / 10; return (v % 1 ? v.toFixed(1) : v.toFixed(0)) + '억'; } return Math.round(w / 1e4).toLocaleString('ko-KR') + '만'; };
export const fmtMan = w => Math.round(w / 1e4).toLocaleString('ko-KR') + '만';
export const fmtManNum = w => Math.round(w / 1e4).toLocaleString('ko-KR');
export const yymm = d => `'${d.slice(2, 4)}.${d.slice(5, 7)}`;
export const fmtDate = d => d.replace(/-/g, '.');
export const areaLabel = l => l.supply_area_pyeong ? `${Math.round(l.supply_area_pyeong)}평` : `전용 ${l.exclusive_area_pyeong.toFixed(1)}평`;
export function markerLabel(m, deal) {
  if (m.kind === 'region') {
    const s = m.summary;
    const l2 = s.median_price_per_pyeong != null ? `평당 ${fmtMan(s.median_price_per_pyeong)}` : s.median_deposit_per_pyeong != null ? `평당 보증금 ${fmtMan(s.median_deposit_per_pyeong)}` : `보증금 ${fmtManNum(s.median_deposit)} · 월 ${fmtManNum(s.median_monthly_rent)}`;
    return { a: m.name, b: l2, c: `${m.transaction_count.toLocaleString('ko-KR')}건` };
  }
  const l = m.latest;
  if (m.kind === 'parcel') return { b: fmtEok(l.price), c: `${l.land_area_pyeong}평 · ${yymm(l.contract_date)}` };
  if (l.deal_type === 'sale') return { b: fmtEok(l.price), c: `${areaLabel(l)} · ${yymm(l.contract_date)}` };
  if (l.deal_type === 'jeonse') return { b: `전세 ${fmtEok(l.deposit)}`, c: areaLabel(l) };
  return { b: `${fmtManNum(l.deposit)}/${fmtManNum(l.monthly_rent)}`, c: areaLabel(l) };
}
const cw = (s, fs) => [...s].reduce((t, ch) => t + (/[가-힣]/.test(ch) ? fs * 0.98 : /[0-9]/.test(ch) ? fs * 0.6 : ch === ' ' ? fs * 0.3 : fs * 0.5), 0);
export function markerSize(m, lab) { if (m.kind === 'region') return { w: Math.max(cw(lab.a, 13), cw(lab.b, 16), cw(lab.c, 13)) + 24, h: 66 }; return { w: Math.max(cw(lab.b, 16), cw(lab.c, 13)) + 22, h: 54 }; }
// 화면 좌표 계산 + 겹침 처리: 우선순위가 낮은 마커가 겹치면 점으로 줄임
export function placeMarkers(markers, view, W, H, selectedId) {
  const s = zoomToScale(view.z);
  const idOf = m => m.complex_id || m.pnu || m.region_code;
  const items = markers.map(m => { const w = toWorld(m.lat, m.lng); const lab = markerLabel(m); return { m, id: idOf(m), sx: (w.x - view.cx) * s + W / 2, sy: (w.y - view.cy) * s + H / 2, lab, size: markerSize(m, lab) }; })
    .filter(i => i.sx > -60 && i.sx < W + 60 && i.sy > -40 && i.sy < H + 80)
    .sort((a, b) => (b.id === selectedId) - (a.id === selectedId) || (b.m.kind === 'region') - (a.m.kind === 'region') || b.m.transaction_count - a.m.transaction_count);
  const placed = [];
  items.forEach(i => {
    const { w, h } = i.size; const rect = i.m.kind === 'region' ? [i.sx - w / 2, i.sy - h / 2, w, h] : [i.sx - w / 2, i.sy - h, w, h];
    const hit = placed.some(p => rect[0] < p[0] + p[2] + 3 && rect[0] + rect[2] + 3 > p[0] && rect[1] < p[1] + p[3] + 3 && rect[1] + rect[3] + 3 > p[1]);
    i.dot = hit && i.id !== selectedId; if (!i.dot) placed.push(rect);
  });
  return items;
}

// ---- API 흉내 (지연 포함) ----
const wait = ms => new Promise(r => setTimeout(r, ms));
export async function getMapMarkers(params) { await wait(300); if (MOCK_MODE === 'error') throw { code: 'NETWORK_ERROR', message: '네트워크에 연결할 수 없어요' }; return getMapMarkersSync(params); }
export async function lookupParcel(p) { await wait(180); return lookupParcelSync(p); }
export async function getComplex(id, deal) { await wait(150); return getComplexSync(id, deal); }
export async function getGlossary(p) { await wait(120); return getGlossarySync(p); }
