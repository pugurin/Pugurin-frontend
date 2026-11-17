# 백엔드 요청: 대중교통 길찾기 (집 → 직장)

사용자가 집(단지·지점)과 직장(장소)을 고르면 대중교통 소요시간·환승·경로를 보여 준다.
카카오에는 공개 대중교통 길찾기 API가 없어 **ODsay LAB API**를 쓴다.
키를 앱에 넣으면 노출·호출 한도 소진 위험이 있어 **백엔드가 서버 키(IP 제한)로 대신 호출**한다.

프론트 구현: `src/api/transit.ts`(타입·샘플), `Repository.transitRoute`.

## 1. 엔드포인트

```
GET /api/v1/transit/routes?from_lat=35.163&from_lng=129.164&to_lat=35.155&to_lng=129.060&limit=3
```

| 파라미터 | 설명 |
| --- | --- |
| `from_lat`, `from_lng` | 출발 WGS84. 프론트가 소수 3자리(약 100m)로 줄여 보낸다(직장 위치 보호) |
| `to_lat`, `to_lng` | 도착 WGS84. 출근이면 직장, 퇴근이면 집 |
| `limit` | 돌려줄 경로 수, 기본 3, 최대 5. 소요시간 짧은 순 |

로그인 없이 호출한다(다른 조회 API와 같이 `X-Device-Id`만 온다).

## 2. 응답

```json
{
  "data": {
    "routes": [
      {
        "total_minutes": 38,
        "transfer_count": 1,
        "fare": 1550,
        "walk_minutes": 9,
        "distance_m": 12840,
        "legs": [
          { "mode": "walk", "minutes": 5, "distance_m": 350, "line": null,
            "start_name": null, "end_name": "해운대역", "stop_count": null },
          { "mode": "subway", "minutes": 24, "distance_m": 11900,
            "line": { "name": "부산 2호선", "color": "#81BF48" },
            "start_name": "해운대역", "end_name": "서면역", "stop_count": 15 },
          { "mode": "walk", "minutes": 4, "distance_m": 290, "line": null,
            "start_name": "서면역", "end_name": null, "stop_count": null }
        ]
      }
    ],
    "unavailable_reason": null
  },
  "meta": { "data_as_of": "2026-11-16T09:00:00+09:00" }
}
```

### ODsay `searchPubTransPathT` → 응답 매핑

| 응답 | ODsay |
| --- | --- |
| `total_minutes` | `path[].info.totalTime` |
| `transfer_count` | `info.busTransitCount + info.subwayTransitCount - 1` (0 미만이면 0) |
| `fare` | `info.payment` (없으면 null) |
| `walk_minutes` | `subPath[]` 중 `trafficType=3`의 `sectionTime` 합 |
| `distance_m` | `info.totalDistance` |
| `legs[].mode` | `trafficType` 1→`subway`, 2→`bus`, 3→`walk`, 그 외(기차·고속/시외버스 등)→`etc` |
| `legs[].minutes` / `distance_m` | `sectionTime` / `distance` |
| `legs[].line.name` | 지하철 `lane[0].name`, 버스 `lane[0].busNo` (여러 노선이면 첫 번째) |
| `legs[].line.color` | 노선 색을 알면 `#RRGGBB`, 모르면 null |
| `start_name` / `end_name` | `startName` / `endName` (걷기 구간은 앞뒤 대중교통 정류장 이름, 처음·끝은 null) |
| `stop_count` | `stationCount` (걷기는 null) |

지도 위 경로선(`loadLane`)은 v1에서 쓰지 않는다. 경로마다 ODsay 호출이 하나씩 늘어나므로 부르지 않는다.

## 3. 경로를 줄 수 없을 때

HTTP 200에 `routes: []`와 이유를 준다.

| `unavailable_reason` | 언제 |
| --- | --- |
| `too_close` | 출발·도착 700m 이내 (ODsay 에러 코드 -98) |
| `no_route` | 대중교통 경로 없음 (ODsay -99 등) |
| `source_unavailable` | ODsay 장애·호출 한도 초과·키 오류 |

좌표 형식이 틀리면 백엔드 관례대로 400 `VALIDATION_ERROR`, 한국 밖 좌표는 `no_route`.
ODsay 장애를 오류로 줄 때는 503 `SOURCE_UNAVAILABLE`을 쓴다(프론트는 200 `source_unavailable`과 같게 보고 다시 시도 버튼을 띄운다).
엔드포인트가 아직 없으면(404) 프론트는 "준비 중"으로 보여 준다. 운영에서는 `EXPO_PUBLIC_TRANSIT=on`일 때만 기능을 켠다.

## 4. 운영

- 키: ODsay 콘솔에서 **Server** 플랫폼 키를 발급하고 배포 서버 IP(34.64.207.41)를 등록한다. `.env`의 `ODSAY_API_KEY`
- 캐시: 같은 출발·도착(소수 3자리) 결과를 24시간 캐시한다. 무료 키는 하루 호출 한도가 있다. **캐시 키에 기기 ID를 넣지 않는다**
- 개인정보: 좌표에 직장 위치가 들어 있다. **요청 쿼리(좌표)를 접근 로그·오류 로그에 남기지 않고**, 기기 ID와 묶어 저장하지 않는다
- 호출 실패는 로그만 남기고 `source_unavailable`로 응답한다(500을 주지 않는다)
- API 명세(`docs/API_SPEC.md`)에 이 엔드포인트를 추가한다
