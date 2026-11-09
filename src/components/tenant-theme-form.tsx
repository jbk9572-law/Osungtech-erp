"use client";

import { useActionState, useState } from "react";
import { setTenantTheme } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";

type TenantOption = { id: string; name: string; theme: string };

const THEME_LABELS: Record<string, string> = {
  "classic-light": "Classic Light (기본)",
  modern: "Modern",
  "classic-b": "Classic B (각진 인디고)",
};

// 회사(테넌트)별로 다른 테마를 줄 수 있어야 해서("관리자페이지에서
// 모던으로 바꾸면 전체 변경되는건데 그걸 업체별로 변경할 수 있게
// 해줘"), 업체 선택과 테마 선택을 한 폼에 같이 둔다. 업체를 바꾸면
// 그 회사의 지금 설정값으로 테마 드롭다운을 맞춰 보여주기만 하고
// (자동 제출 없음 — PlatformDefaultPlanSelect와 달리 여기서 자동
// 제출하면 업체를 훑어보기만 해도 의도치 않게 이전 화면에 남아있던
// 테마값으로 덮어쓸 위험이 있다), "적용" 버튼을 눌러야만 실제로
// 저장된다.
export function TenantThemeForm({ tenants }: { tenants: TenantOption[] }) {
  const [state, action, pending] = useActionState(setTenantTheme, undefined);
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [theme, setTheme] = useState(tenants[0]?.theme ?? "classic-light");

  function handleTenantChange(nextId: string) {
    setTenantId(nextId);
    setTheme(tenants.find((t) => t.id === nextId)?.theme ?? "classic-light");
  }

  if (!tenants.length) {
    return <p className="erp-grid-empty">등록된 회사가 없습니다.</p>;
  }

  return (
    <div className="erp-field" style={{ maxWidth: 520 }}>
      <label htmlFor="tenant-theme-company">회사(테넌트)</label>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <ErpSelect
          id="tenant-theme-company"
          name="tenantId"
          value={tenantId}
          onChange={handleTenantChange}
          options={tenants.map((t) => ({ value: t.id, label: t.name }))}
        />
        <ErpSelect
          id="tenant-theme-select"
          name="theme"
          value={theme}
          onChange={setTheme}
          ariaLabel="테마"
          options={Object.entries(THEME_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ minWidth: 0 }}>
          {pending ? "적용 중..." : "적용"}
        </button>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
