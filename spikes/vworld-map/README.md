# D1 지도 시험 구현 — MapLibre + VWorld / OpenFreeMap (#4)

지도는 VWorld API를 쓰기로 했다. VWorld는 모바일 네이티브 SDK가 없으므로
**MapLibre React Native(`@maplibre/maplibre-react-native` 11.x)** 로 VWorld 타일을 그린다.
VWorld 인증키가 아직 없어서, 키가 없으면 **OpenFreeMap**(키 불필요 무료 지도, OpenStreetMap 데이터)을 배경으로 쓴다.
키를 넣으면 VWorld 일반·위성·지적도가 켜진다. 이 폴더는 확인용 앱이며, 실제 앱(F1, #9)에 그대로 가져가지 않는다.

## 실행

```bash
cp .env.example .env.local   # VWorld 인증키 (선택. 없으면 OpenFreeMap 사용)
npm install
LANG=en_US.UTF-8 npx expo run:ios       # CocoaPods는 UTF-8 로케일 필요
JAVA_HOME=<JDK 17> npx expo run:android # JDK 25에선 Gradle 빌드 실패 가능
```

Expo Go로는 실행되지 않는다(네이티브 모듈). development build가 필요하다.

## 구성

| 요소 | 방식 |
| --- | --- |
| 배경 지도 (키 없음) | OpenFreeMap `liberty` 벡터 스타일. 지명은 `name:ko` 우선으로 바꿔 한글 표시 |
| 배경 지도 (키 있음) | VWorld WMTS `Base`(png) / `Satellite`(jpeg), `RasterSource` 타일 256px, 줌 6~19 |
| 지적도 (키 있음) | VWorld WMS `lp_pa_cbnd_bubun`, `lp_pa_cbnd_bonbun` (`{bbox-epsg-3857}`), 줌 14 이상 |
| 실거래가 마커 | `GeoJSONSource` + `symbol` 레이어 (GPU 렌더링, 겹침 자동 처리) |
| 필지 하이라이트 | `GeoJSONSource` + `fill` / `line` 레이어 (실제 앱은 `/parcels/lookup`의 `geometry`) |
| 도메인 검사 대비 | `TransformRequestManager.addHeader`로 `api.vworld.kr` 요청에 Referer 추가 |

## 결과 (2026-10-06 · iOS 시뮬레이터 iPhone 17 / Android 에뮬레이터 Pixel API 36)

| 항목 | 결과 |
| --- | --- |
| 마커 500개 — 심볼 레이어 | ✅ iOS 렌더 약 18ms · JS 60fps / Android 약 72ms · 60fps (배경 없이). OpenFreeMap 배경 위에서도 iOS 22ms · 58fps / Android 240ms · 52fps(에뮬레이터). 드래그 부드러움, 겹치는 라벨 자동 숨김 |
| 마커 500개 — RN 뷰 마커(`Marker`) | ❌ iOS 약 2,467ms · JS 5fps / Android 약 1,436ms · 29fps. 겹침 처리 없음 → 마커에는 쓰지 않는다 |
| 한글 라벨 | ✅ iOS·Android 모두 표시. 숫자·영문은 글리프 서버(OpenFreeMap `Noto Sans Bold`), 한글은 기기 폰트로 로컬 렌더링. ⚠️ 글리프 서버에 접속하지 못하면 **심볼 레이어 전체가 안 그려짐**(Android 에뮬레이터 DNS 문제로 재현) → 실제 앱은 글리프를 앱에 번들하거나 자체 CDN에 둔다 |
| 지도 탭 → 좌표 | ✅ `onPress`의 `lngLat` |
| 필지 폴리곤 하이라이트 | ✅ iOS·Android 모두 줌 16에서 탭 위치에 정확히 표시 |
| 드래그 이동 / 핀치 확대 / `zoomTo` 애니메이션 | ✅ |
| 줌 체계 | ⚠️ MapLibre 줌은 **512px 타일 기준**(mapbox-gl/maplibre-gl과 같음). 256px 타일 기준 줌보다 1 작다 → 백엔드 `/map/markers`의 `zoom` 기준을 명시해야 함 (D3, #6) |
| OpenFreeMap 배경 (키 없음) | ✅ iOS·Android 부산 지도 + 한글 지명 표시 |
| VWorld 배경 타일 · 지적도 | ⏳ 인증키 발급 후 확인 (D2, #5) |

## 결론과 다음 단계

- **MapLibre로 간다.** 배경은 VWorld(키 발급 후), 그 전까지 개발·시연은 OpenFreeMap으로 한다. 배경만 바꾸면 되도록 마커·필지 레이어는 배경과 분리해 둔다. 실거래가 마커는 반드시 심볼 레이어로 그린다.
- 디자인의 마커 모양(유형 색 칸 + 흰 칸 + 꼬리)은 심볼 레이어의 `icon-image` + `icon-text-fit`(늘어나는 배경 이미지)로 구현한다. 선택된 마커 1개처럼 소수만 RN 뷰로 그려도 된다.
- 마커 라벨 글리프(숫자·영문)는 앱에 번들하거나 자체 CDN에 둔다. 외부 글리프 서버에 의존하지 않는다.
- OpenFreeMap은 무료 공개 서비스라 상용 트래픽·가용성 보장이 없다. 출시 전 VWorld로 바꾸거나 자체 타일 서버를 둔다. 지적도는 VWorld에만 있다.
- 남은 확인: VWorld 키로 타일·지적도 표시, 모바일 앱에서의 도메인 검사 조건, 일일 호출 한도.
