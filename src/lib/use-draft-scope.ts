"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 임시저장(localStorage)은 이 브라우저의 모든 계정이 같은 저장소를 쓴다. 키에 로그인한 사용자 id를 넣지 않으면
// 공용 PC에서 다른 사람·다른 회사 계정으로 로그인했을 때 앞사람의 전표 초안(거래처·단가)이 "이어서 작성" 배너로 보인다.
// 그래서 사용자 id를 알아낸 뒤에만 임시저장을 켠다(그 전에는 null → 임시저장 꺼짐). 예전 전역 키는 한 번 지운다.
const LEGACY_KEYS = ["erp-draft:sale:new", "erp-draft:purchase:new"];
let cachedUserId: string | null = null;

export function useDraftScope(): string | null {
  const [scope, setScope] = useState<string | null>(cachedUserId);
  useEffect(() => {
    if (cachedUserId) return;
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const id = data.user?.id ?? null;
        if (!id || cancelled) return;
        cachedUserId = id;
        try {
          LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
        } catch {
          /* 저장소를 못 쓰는 환경 — 임시저장은 편의 기능이라 조용히 포기 */
        }
        setScope(id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return scope;
}

/** 임시저장 키 — 사용자 id가 붙은 키를 돌려준다(아직 모르거나 base가 null이면 null → 임시저장 꺼짐). */
export function useDraftKey(base: string | null): string | null {
  const scope = useDraftScope();
  return base && scope ? `${base}:${scope}` : null;
}
