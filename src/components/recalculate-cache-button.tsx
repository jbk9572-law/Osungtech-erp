"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { recalculateInventoryCache } from "@/app/(dashboard)/inventory/actions";

// /inventory/count "지금 자동 교정" 버튼 — recalculate_inventory_cache()가
// FormState를 돌려주게 바뀌어서(migration 207, 관리자 전용 가드 추가),
// 서버 컴포넌트의 <form action={fn}>만으로는 에러를 화면에 보여줄 수
// 없어 다른 등록 폼들과 같은 useActionState + FormMessage 패턴으로
// 뺐다. 이 컴포넌트는 관리자에게만 렌더링된다(count/page.tsx의 isAdmin
// 체크) — 그래도 DB 가드가 최종 방어선이라 여기서 다시 권한을 묻지
// 않는다.
export function RecalculateCacheButton() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recalculateInventoryCache, undefined);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ flexShrink: 0 }}>
        {pending ? "교정 중..." : "지금 자동 교정"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
