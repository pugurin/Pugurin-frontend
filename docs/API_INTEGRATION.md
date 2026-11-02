# 메인 API 연결 검증

백엔드 main `573a70e` 기준. 백엔드 코드는 변경하지 않는다.

| 화면 | 실제 연결 | 상태 |
|---|---|---|
| 지도·필터·마커 | `/map/markers` | 연결 |
| 단지·동네·주소 검색 | `/search` | 연결, 주소 결과는 서버 REST 키 설정 필요 |
| 단지 정보 | `/complexes/{id}` | 연결 |
| 단지 거래 이력 | `/complexes/{id}/transactions` | 연결, 매매·전세·월세/정렬/해제거래/페이지 |
| 용어 목록·설명 | `/glossary` | 연결, 목록에서 선택한 실제 상세 사용 |
| 지역/지도 범위 거래목록 | `/transactions` | 연결, 부산 영역·유형·기간·가격·정렬·해제·페이지 |
| 지역 시세 추이 | `/stats/regions/{region_code}` | 연결, 거래 유형별 지표·기간·직거래 제외 |
| 단지 평형별 시세·지역 비교 | `/complexes/{id}/stats` 및 지역 통계 | 연결, 서버 평형별 응답과 같은 36개월 지역 통계 |
| 단지 분석 | `/analysis/complexes/{id}` | 연결, 같은 법정동 비교·실제 용도지역 응답 |
| 토지 A·B | `/parcels/lookup`, 지역 통계·거래 목록 | 공급처 상태에 따라 지역 또는 실제 필지 화면 |
| 경매·공매 목록·마커 | `/auctions` | 백엔드 main에는 있음, 배포 서버 반영은 재배포 후. 지도 bbox·물건 그룹·지분 제외, 서버 정렬(`sort`)은 `sale_date`·`min_price_ratio`·`min_price`·`recent_trade_discount` |
| 경매·공매 상세 | `/auctions/{id}` | 백엔드 main에는 있음, 배포 서버 반영은 재배포 후. 기일 이력·결과 포함 |

`X-Device-Id`는 기기에 UUID로 보관한다. 기존 spike의 저장 키와 서버 주소 설정을 지원한다. ETag 재조회 304, 취소 요청, 오류 및 서버의 X-Data-Mode를 처리한다. API 오류를 샘플로 자동 대체하지 않는다.

## 검증 결과

`npm run verify:api`: 실제 로컬 서버에 15개 HTTP 조회 200, 조건부 재조회 304, 한 글자 검색 400. 서버는 sample 모드이므로 공공데이터 실데이터 및 카카오 외부 주소 검색 검증은 아니다.

`npm test`: 클라이언트·필터·미구현 API 요청 차단·화면 상태 테스트. `npm run verify:ui`는 로컬 API와 연결된 360×780 브라우저에서 검색→단지 3단계→거래이력→용어 상세를 검증한다. `PUGURIN_CHROMIUM_PATH`로 로컬 Chromium 실행 파일을 지정할 수 있다.

### 경매 API (`/auctions`, `/auctions/{id}`)

백엔드 main(#53, `909df9b`)이 목록·상세에 실거래 비교 필드 `recent_trade_price`, `recent_trade_date`, `recent_trade_area_m2`, `recent_trade_count`를 주고, 목록에 `sort`(`sale_date` | `min_price_ratio` | `min_price` | `recent_trade_discount`)와 `exclude_share` 쿼리를 받는다. 프론트는 이 값을 그대로 쓰고 정렬·지분 거르기를 직접 하지 않는다. 매칭이 안 되어 비교 필드가 없거나 null이면 비교 줄과 실거래 막대를 숨긴다. 서버가 `sort`·`exclude_share`를 못 받는 빌드로 돌아가면 `src/state/auction.ts`의 `AUCTION_SERVER_SORT`를 false로 바꾼다.

배포 서버(34.64.207.41)는 아직 `/auctions`가 없는 빌드일 수 있다. 백엔드 main에는 있고 배포 서버 반영은 재배포 후다. 그 전에는 404(응답에 코드가 없으면 클라이언트가 `RESOURCE_NOT_FOUND`로 바꿔 다룬다, `src/api/client.ts`)나 수집 전 503(`DATA_NOT_READY`)이 오며, 프론트는 매매 지도에는 오류를 띄우지 않고 경매 탭·목록 화면에 "경매 정보를 준비 중이에요"를 안내한다. 경매 마커는 줌 14 이상(`AUCTION_MIN_ZOOM`)에서만 요청한다. API 응답 `meta.source_attribution`은 출처로 화면에 표시한다.

API 추가 머지 후 이 문서의 준비 상태와 Repository 어댑터를 함께 갱신한다.

새 ZIP의 토지 화면도 포함한다. 공급처가 없으면 선택한 지역의 토지 거래·서버 월별 중위값, 실제 필지 응답이 있으면 필지 기본 정보·용도지역·규제를 표시한다. 지목별 필터와 분기 중위값, 필지 건축 규모 계산은 현재 API에 없어 지원하지 않음을 밝히며 만들지 않는다. 새 단지 분석은 `/analysis/complexes/{id}`로 연결하고 없는 용도지역은 임의로 채우지 않는다.
