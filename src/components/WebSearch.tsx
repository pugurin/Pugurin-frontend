import React, { useEffect, useId, useRef, useState } from "react";
import type { Repository } from "../api/repository";
import type { SearchResult } from "../api/types";
import type { Recent } from "../state/storage";
import { C, FONT } from "../theme/tokens";

const groupLabels = { complex: "단지", region: "동네", address: "주소" };
const types = ["complex", "region", "address"] as const;
const label = (result: SearchResult) =>
  result.name ?? result.address ?? "검색 결과";

export function WebSearch({
  repo,
  recent,
  onRecent,
  onSelect,
  onClose,
}: {
  repo: Repository;
  recent: Recent[];
  onRecent: (recent: Recent[]) => void;
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searching = query.trim().length >= 2;
  const options = searching
    ? types.flatMap((type) => results.filter((result) => result.type === type))
    : recent.map((record) => record.result);
  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    setActive(-1);
    setError(undefined);
    setLoading(searching);
    if (!searching) return () => controller.abort();
    const timer = setTimeout(() => {
      repo
        .search(query.trim(), controller.signal)
        .then((response) => {
          if (!controller.signal.aborted) setResults(response.data);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setError(cause.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [repo, query, retry, searching]);
  useEffect(() => {
    if (active >= 0)
      document
        .getElementById(optionId(active))
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const select = (result: SearchResult) => {
    onSelect(result);
    onClose();
  };
  const keyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (["ArrowDown", "ArrowUp"].includes(event.key) && options.length) {
      event.preventDefault();
      setActive((index) =>
        event.key === "ArrowDown"
          ? (index + 1) % options.length
          : index <= 0
            ? options.length - 1
            : index - 1,
      );
    } else if (event.key === "Enter" && active >= 0 && options[active]) {
      event.preventDefault();
      select(options[active]);
    }
  };
  const resultRow = (result: SearchResult, index: number) => (
    <button
      key={`${result.type}-${result.complex_id ?? result.region_code ?? result.address}-${index}`}
      id={optionId(index)}
      type="button"
      role="option"
      aria-label={label(result)}
      aria-selected={active === index}
      tabIndex={-1}
      onMouseEnter={() => setActive(index)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => select(result)}
      style={{ ...row, background: active === index ? C.greenWash : C.surface }}
    >
      <span style={{ fontWeight: 700, color: C.ink }}>{label(result)}</span>
      {result.name && result.address && (
        <span style={{ color: C.muted, fontSize: 13 }}>{result.address}</span>
      )}
    </button>
  );

  return (
    <div
      style={{
        width: 520,
        maxWidth: "100%",
        overflow: "hidden",
        background: C.surface,
        borderRadius: 16,
        border: `1px solid ${C.rule}`,
        boxShadow: "0 12px 40px rgba(30,45,29,.18)",
        fontFamily: FONT,
        color: C.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 12,
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        <input
          ref={input}
          role="combobox"
          aria-label="단지·주소·동네 검색"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={
            active >= 0 && options[active] ? optionId(active) : undefined
          }
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={keyDown}
          placeholder="단지·주소·동네 검색"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 12px",
            border: `1px solid ${C.greenRule}`,
            borderRadius: 10,
            fontFamily: "inherit",
            fontSize: 16,
            background: C.bg,
            color: C.ink,
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            style={plainButton}
          >
            지우기
          </button>
        )}
        <button
          type="button"
          aria-label="검색 닫기"
          onClick={onClose}
          style={plainButton}
        >
          ×
        </button>
      </div>
      <div
        style={{
          maxHeight: "min(500px, 65vh)",
          overflowY: "auto",
          padding: 12,
        }}
      >
        {!searching && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 6px 12px",
            }}
          >
            <strong>최근 검색</strong>
            <button
              type="button"
              onClick={() => onRecent([])}
              style={plainButton}
            >
              전체 삭제
            </button>
          </div>
        )}
        {loading ? (
          <p role="status" style={message}>
            검색하는 중…
          </p>
        ) : error ? (
          <div role="alert" style={message}>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              style={plainButton}
            >
              다시 시도
            </button>
          </div>
        ) : searching && !options.length ? (
          <p style={message}>
            검색 결과가 없어요. 다른 단지나 동네 이름을 입력해 주세요.
          </p>
        ) : (
          <div
            role="listbox"
            id={listId}
            aria-label={searching ? "검색 결과" : "최근 검색"}
          >
            {searching
              ? types.map((type) => {
                  const group = options.filter(
                    (result) => result.type === type,
                  );
                  return group.length ? (
                    <div key={type} role="group" aria-label={groupLabels[type]}>
                      <div
                        style={{
                          padding: "12px 8px 6px",
                          color: C.muted,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {groupLabels[type]} · {group.length}
                      </div>
                      {group.map((result) =>
                        resultRow(result, options.indexOf(result)),
                      )}
                    </div>
                  ) : null;
                })
              : recent.map((record, index) => (
                  <div
                    key={`${record.label}-${index}`}
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    {resultRow(record.result, index)}
                    <button
                      type="button"
                      aria-label={`${record.label} 삭제`}
                      onClick={() => {
                        setActive(-1);
                        onRecent(recent.filter((_, i) => i !== index));
                      }}
                      style={plainButton}
                    >
                      ×
                    </button>
                  </div>
                ))}
          </div>
        )}
        {!searching && (
          <p style={{ ...message, fontSize: 13 }}>
            {recent.length
              ? "최근 검색은 이 기기에만 저장돼요."
              : "최근 검색이 없어요. 2글자 이상 입력하면 검색해요."}
          </p>
        )}
      </div>
      <div
        style={{
          padding: "10px 18px",
          borderTop: `1px solid ${C.rule}`,
          fontSize: 12,
          color: C.muted,
        }}
      >
        ↑↓ 결과 이동 · Enter 선택 · Esc 닫기
      </div>
    </div>
  );
}
const plainButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: C.muted,
  padding: "10px",
  cursor: "pointer",
  fontFamily: "inherit",
  flexShrink: 0,
};
const row: React.CSSProperties = {
  width: "100%",
  border: 0,
  textAlign: "left",
  padding: "14px 12px",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 16,
};
const message: React.CSSProperties = {
  color: C.muted,
  padding: "12px 6px",
  margin: 0,
  lineHeight: 1.6,
};
