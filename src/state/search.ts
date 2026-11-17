// 검색 결과 묶음의 순서와 이름. 웹 드롭다운(WebSearch)과 앱 검색 화면(SearchScreen)이 같이 쓴다
import type { SearchResult } from "../api/types";

export const SEARCH_TYPES = [
  "region",
  "station",
  "school",
  "complex",
  "address",
] as const satisfies readonly SearchResult["type"][];

export const SEARCH_LABEL: Record<SearchResult["type"], string> = {
  region: "동네",
  station: "지하철역",
  school: "학교",
  complex: "단지",
  address: "주소",
};

// 동네 → 지하철역 → 학교 → 단지 → 주소로 다시 늘어놓는다. 묶음 안에서는 받은 순서(관련도 순)를 지킨다.
// 백엔드는 동네 다음을 점수 순으로 섞어 주고, 앱이 학교 목록에서 찾은 학교는 맨 뒤에 붙기 때문이다
export function groupResults(results: SearchResult[]): SearchResult[] {
  return SEARCH_TYPES.flatMap((type) =>
    results.filter((result) => result.type === type),
  );
}
