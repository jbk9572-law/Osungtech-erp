"use client";

import { useMemo, useState } from "react";

// 매출/매입/상품/거래처 그리드가 전부 똑같은 정렬 로직(문자/숫자 비교, 헤더
// 클릭 시 오름차순→내림차순→해제 순환, ▲▼ 표시)을 각자 파일에 복붙해서
// 갖고 있었다 — 정렬 버튼 접근성(aria-sort)을 한 곳만 고치고 나머지에
// 반영이 안 되는 식으로 놓치는 일이 반복됐다. 이 훅 하나로 통일한다.
export type SortDir = 1 | -1;
export type SortState<K extends string> = { key: K; dir: SortDir } | null;

export function useSortableRows<Row, K extends keyof Row & string>(rows: Row[]) {
  const [sort, setSort] = useState<SortState<K>>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""), "ko");
      return cmp * sort.dir;
    });
  }, [rows, sort]);

  function toggleSort(key: K) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 1 };
      if (prev.dir === 1) return { key, dir: -1 };
      return null;
    });
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
