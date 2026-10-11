// 화면 깊은 곳(시트 등)에서 용어 목록을 쓰고 용어 상세를 열기 위한 컨텍스트
import { createContext, useContext } from "react";
import type { Term } from "../api/types";

export type GlossaryContextValue = {
  terms: Term[];
  openTerm: (term: Term) => void;
};

export const GlossaryContext = createContext<GlossaryContextValue>({
  terms: [],
  openTerm: () => {},
});

export const useGlossary = () => useContext(GlossaryContext);
