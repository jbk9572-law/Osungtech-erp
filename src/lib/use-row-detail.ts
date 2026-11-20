"use client";

import { useEffect, useRef, useState } from "react";
import { createRowDetailCache } from "@/lib/row-detail-cache";

// 같은 행을 다시 눌렀을 때 서버를 또 부르지 않는 시간 — 짧게 둬서 다른 화면에서 바꾼 값이 오래 남지 않게 한다.
const DETAIL_CACHE_MS = 30_000;

// 목록에서 고른 행의 상세를 그때그때(서버 액션으로) 불러오는 공용 훅 — 목록을 열 때 전체 행의 상세를 받아 오지 않는다(응답속도 기준).
// id가 바뀌면 이전 요청 결과는 버리고, 새 결과가 올 때까지 loading=true. 실패하면 data=null.
// 거래량이 많은 회사는 한 건 조회도 무거울 수 있어, 이 화면을 연 동안 같은 행은 30초간 다시 부르지 않는다.
export function useRowDetail<T>(id: string | null, load: (id: string) => Promise<T | null>): { data: T | null; loading: boolean } {
  const [result, setResult] = useState<{ id: string; data: T | null } | null>(null);
  const cacheRef = useRef<ReturnType<typeof createRowDetailCache<T | null>> | null>(null);
  useEffect(() => {
    if (!id) return;
    cacheRef.current ??= createRowDetailCache<T | null>(DETAIL_CACHE_MS);
    const cache = cacheRef.current;
    let alive = true;
    const cached = cache.get(id);
    const request = cached !== undefined ? Promise.resolve(cached) : load(id).then((d) => (cache.set(id, d), d));
    request
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
