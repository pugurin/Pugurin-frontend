# 퍼그린 앱

Expo + React Native + TypeScript로 만든 iOS/Android 앱이다. 와이어프레임 v2 1차 화면을 구현하며 **6번 토지 요약·상세(S07)는 제외**한다. 지도는 **MapLibre**로 그린다(앱: `@maplibre/maplibre-react-native`, 웹: `maplibre-gl`).

## 실행

```sh
npm ci                      # postinstall이 maplibre-gl 웹 워커를 public/maplibre/로 복사한다
cp .env.example .env.local
npm run ios                 # 처음 한 번: 네이티브 빌드(development build) 설치
npm start                   # 이후에는 개발 서버만
```

MapLibre는 네이티브 모듈이라 **Expo Go로는 실행되지 않는다.** `npm run ios` / `npm run android`로 development build를 설치한다. iOS 빌드 중 CocoaPods 오류가 나면 `LANG=en_US.UTF-8`을, Android Gradle 오류가 나면 JDK 17(`JAVA_HOME`)을 지정한다.

iOS 시뮬레이터 API 주소는 localhost:8000, Android 에뮬레이터는 10.0.2.2:8000이다. 실제 휴대폰은 EXPO_PUBLIC_API_URL에 접근 가능한 HTTPS 백엔드의 /api/v1 주소를 입력한다. 기존 EXPO_PUBLIC_API_BASE 서버 주소도 지원한다.

웹 미리보기는 별도 터미널에서 `npm run api:dev`와 `npm run web`을 실행한다. 개발 중계는 같은 PC의 백엔드만 사용하고 127.0.0.1:8001에 바인딩한다. 배포 서버에서 사용하지 않는다.

배경 지도는 VWorld 인증키(`EXPO_PUBLIC_VWORLD_KEY`)가 있으면 VWorld 일반·위성 지도와 지적도를, 없으면 키가 필요 없는 **OpenFreeMap**(OpenStreetMap 데이터, 지명은 한글 우선)을 쓴다. OpenFreeMap은 무료 공개 서비스라 가용성 보장이 없어 출시 전에는 VWorld로 바꾼다. 위성 지도와 지적도는 VWorld 키가 있어야 보인다. 실거래가 마커는 MapLibre 심볼 레이어로 그리며(500개에서 60fps 근처, #4), 겹치는 마커는 점으로 줄인다. 지도 줌은 MapLibre 줌 + 1을 화면·API 줌으로 쓴다.

## 구현 범위

지도·거래유형·필터·기간·레이어·면적 단위, 검색·최근 검색어, 지역 시트, 단지 3단계 시트·거래 이력, 거래 목록 화면, 용어 목록·검색·팝업·상세·예시 그림, 더보기·기준일·약관 진입점을 제공한다.

백엔드 메인에 없는 지역 거래목록·통계·분석은 API 준비 상태를 표시한다. 백엔드를 추가 구현하거나 프론트에서 통계를 계산하지 않는다. 샘플 데이터는 더보기에서 명시적으로 선택할 때만 사용하며 API 오류를 자동 대체하지 않는다. 2차 로그인·관심·채팅, 광고 SDK 및 실제 약관 원문은 준비 상태다. 단지 면적 칩은 면적 정보를 보여주며 API가 면적 필터를 제공하지 않아 거래이력에는 모든 면적이 나온다.

`spikes/vworld-map`은 MapLibre 지도 검증용 코드다(#4). 본 앱은 root의 App.tsx에서 시작하며 지도 코드는 `src/map/`에 있다(`style.ts`: 앱·웹 공통 스타일과 마커 레이어, `MapCanvas.tsx`: 앱, `MapCanvas.web.tsx`: 웹). `src/map/document.ts`는 이전 카카오맵 WebView 구현으로 더 이상 쓰지 않으며, 열려 있는 PR #52 머지 후 정리한다.

## 검증

```sh
npm test
npm run typecheck
npm run build:web
npm run verify:api
npm run verify:ui
npx expo export --platform ios --platform android
```

UI 검증에는 로컬 8081 미리보기와 8001 개발 중계가 필요하다. Playwright Chromium이 설치되어 있어야 하고 필요시 PUGURIN_CHROMIUM_PATH를 지정한다. 현재 검증은 브라우저의 모바일 크기와 네이티브 JS 번들 기준이며 iOS/Android 실기기 설치 검증은 별도다.

상세 API 연결 상태와 실제 응답 검증 결과는 [API 연결 문서](docs/API_INTEGRATION.md)를 참고한다.

## UI·지도 조작 수정

초기 지도는 대한민국 전역으로 시작한다. 지도는 부산 밖으로 이동할 수 있으며, 거래 조회는 화면 안에 들어온 부산 영역만 요청한다. 부산 데이터 지원 안내가 지도를 가리는 팝업으로 계속 남지 않는다.

본문과 아이콘을 축소하고 검색·탭·버튼·필터를 작게 조정했다. 줌 버튼은 정수 줌 단위로 260ms, 검색·마커 이동은 360ms 애니메이션을 적용한다.

배경 지도 출처(OpenFreeMap · OpenMapTiles · OpenStreetMap, 또는 VWorld)는 지도 왼쪽 아래에 표시한다.

`npm run verify:map`은 360×780 화면에서 전국 범위, 실제 SVG 로드, 줌 이동 폭, 부산 밖 탐색, 직거래 스위치와 API 적용을 확인한다. 실행 조건은 기존 UI 검증과 같다.
