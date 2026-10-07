import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { SearchResult } from "../api/types";
import type { Repository } from "../api/repository";
import type { Recent } from "../state/storage";
import { C } from "../theme/tokens";
import { Header, Icon, IconBtn, StateCard, T, s } from "../components/ui";
export function SearchScreen({
  repo,
  recent,
  onRecent,
  onSelect,
  onBack,
}: {
  repo: Repository;
  recent: Recent[];
  onRecent: (r: Recent[]) => void;
  onSelect: (r: SearchResult) => void;
  onBack: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return () => controller.abort();
    }
    setLoading(true);
    const timer = setTimeout(
      () =>
        repo
          .search(q.trim(), controller.signal)
          .then((r) => {
            if (!controller.signal.aborted) {
              setResults(r.data);
              setError(null);
            }
          })
          .catch((e) => {
            if (!controller.signal.aborted) setError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, repo, retry]);
  const row = (r: SearchResult, i: number) => (
    <Pressable
      key={`${r.type}-${i}`}
      accessibilityRole="button"
      onPress={() => onSelect(r)}
      style={{
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: C.rule,
        gap: 3,
      }}
    >
      <View style={s.between}>
        <View style={{ flex: 1, gap: 4 }}>
          <T size={12} color={C.light}>
            {r.type === "complex"
              ? "단지"
              : r.type === "region"
                ? "동네"
                : "주소"}
          </T>
          <T size={18} bold>
            {r.name ?? r.address}
          </T>
          {r.name && r.address && (
            <T size={14} color={C.muted}>
              {r.address}
            </T>
          )}
        </View>
        <Icon name="right" size={20} />
      </View>
    </Pressable>
  );
  return (
    <View style={s.screen}>
      <Header title="검색" onBack={onBack} />
      <View
        style={[
          s.row,
          {
            margin: 16,
            borderWidth: 1,
            borderColor: C.rule,
            borderRadius: 12,
            paddingLeft: 12,
            backgroundColor: C.surface,
          },
        ]}
      >
        <Icon name="search" color={C.light} />
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="단지·주소·동네 검색"
          style={[s.input, { flex: 1, borderWidth: 0, paddingLeft: 0 }]}
        />
        {q !== "" && (
          <IconBtn
            name="close"
            label="검색어 지우기"
            onPress={() => setQ("")}
          />
        )}
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
      >
        {q.trim().length < 2 ? (
          <>
            <T size={14} color={C.light}>
              2글자 이상 입력하면 검색해요
            </T>
            <View style={[s.between, { marginTop: 24 }]}>
              <T bold>최근 검색어</T>
              <Pressable
                onPress={() => onRecent([])}
                accessibilityRole="button"
                style={{ padding: 10 }}
              >
                <T size={14} color={C.muted}>
                  전체 삭제
                </T>
              </Pressable>
            </View>
            {recent.length === 0 && (
              <T size={15} color={C.light} style={{ paddingVertical: 24 }}>
                최근 검색어가 없어요
              </T>
            )}
            {recent.map((r, i) => (
              <View key={r.label} style={s.row}>
                <View style={{ flex: 1 }}>{row(r.result, i)}</View>
                <IconBtn
                  name="close"
                  label={`${r.label} 삭제`}
                  onPress={() => onRecent(recent.filter((_, j) => j !== i))}
                />
              </View>
            ))}
            <T size={13} color={C.light} style={{ marginTop: 20 }}>
              최근 검색어는 이 기기에만 저장돼요
            </T>
          </>
        ) : loading || error ? (
          <StateCard
            loading={loading}
            error={error}
            onRetry={() => setRetry((x) => x + 1)}
          />
        ) : (
          <>
            <T size={14} color={C.muted}>
              결과 {results.length}개 · 관련도 순
            </T>
            {results.length ? (
              results.map(row)
            ) : (
              <StateCard empty="검색 결과가 없어요" />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
