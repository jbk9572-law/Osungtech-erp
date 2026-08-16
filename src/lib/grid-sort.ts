"use client";

import { useMemo, useState } from "react";

// 매출/매입/상품/거래처 그리드가 전부 똑같은 정렬 로직(문자/숫자 비교, 헤더
// 클릭 시 오름차순→내림차순→해제 순환, ▲▼ 표시)을 각자 파일에 복붙해서
// 갖고 있었다 — 정렬 버튼 접근성(aria-sort)을 한 곳만 고치고 나머지에
// 반영이 안 되는 식으로 놓치는 일이 반복됐다. 이 훅 하나로 통일한다.
export type SortDir = 1 | -1;
export type SortState<K extends string> = { key: K; dir: SortDir } | null;

// 정렬 상태 전이와 값 비교는 React 없이도 테스트할 수 있게 순수 함수로
// 뺐다 — 이 프로젝트엔 훅 렌더링 테스트 도구가 없어서, 헤더 클릭 순환
// (오름차순→내림차순→해제)과 숫자/문자 비교 분기를 직접 검증하려면
// 이렇게 분리하는 수밖에 없다.
export function nextSortState<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  if (!prev || prev.key !== key) return { key, dir: 1 };
  if (prev.dir === 1) return { key, dir: -1 };
  return null;
}

export function compareSortValues(av: unknown, bv: unknown): number {
  return typeof av === "number" && typeof bv === "number"
    ? av - bv
    : String(av ?? "").localeCompare(String(bv ?? ""), "ko");
}

export function useSortableRows<Row, K extends keyof Row & string>(rows: Row[]) {
  const [sort, setSort] = useState<SortState<K>>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => compareSortValues(a[sort.key], b[sort.key]) * sort.dir);
  }, [rows, sort]);

  function toggleSort(key: K) {
    setSort((prev) => nextSortState(prev, key));
  }

  function sortIndicator(key: K) {
    if (!sort || sort.key !== key) return "";
    return sort.dir === 1 ? " ▲" : " ▼";
  }

  function ariaSortFor(key: K): "ascending" | "descending" | "none" {
    if (sort?.key !== key) return "none";
    return sort.dir === 1 ? "ascending" : "descending";
  }

  return { sortedRows, sort, toggleSort, sortIndicator, ariaSortFor };
}
