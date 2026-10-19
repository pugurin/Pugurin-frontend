import React, { createContext } from "react";
import type { Term } from "../api/types";
export const LearningContext = createContext<{
  terms: Term[];
  tipsEnabled: boolean;
  onTerm?: (term: Term) => void;
}>({ terms: [], tipsEnabled: true });
export const LearningProvider = LearningContext.Provider;
