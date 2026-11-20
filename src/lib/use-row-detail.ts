"use client";

import { useEffect, useState } from "react";

// 목록에서 고른 행의 상세를 그때그때(서버 액션으로) 불러오는 공용 훅 — 목록을 열 때 전체 행의 상세를 받아 오지 않는다(응답속도 기준).
// id가 바뀌면 이전 요청 결과는 버리고, 새 결과가 올 때까지 loading=true. 실패하면 data=null.
export function useRowDetail<T>(id: string | null, load: (id: string) => Promise<T | null>): { data: T | null; loading: boolean } {
  const [result, setResult] = useState<{ id: string; data: T | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    load(id)
      .then((data) => alive && setResult({ id, data }))
      .catch(() => alive && setResult({ id, data: null }));
    return () => {
      alive = false;
    };
    // load는 모듈 수준 서버 액션이라 바뀌지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const ready = !!id && result?.id === id;
  return { data: ready ? result.data : null, loading: !!id && !ready };
}
