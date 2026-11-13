"use client";

import { useActionState } from "react";
import { deleteTenant } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { useConfirmCode } from "@/lib/use-confirm-code";
import { PageGuide } from "@/components/erp/page-guide";

// server-restore-form.tsx(DB 전체를 통째로 되돌리는 작업)와 같은 수준의
// 확인 방식을 쓴다 — 이것도 되돌릴 수 없고 그보다 더 넓은 범위(이 회사의
// 매출/매입/재고/거래처 등 전 데이터)를 영구 삭제하는 작업이다. 나머지
// 안전장치(플랫폼 운영 주체/본인 소속 테넌트 차단)는 delete_tenant_hard()
// RPC 안에서 처리한다.
export function DeleteTenantForm({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [state, formAction, pending] = useActionState(deleteTenant, undefined);
  const { code, confirmText, setConfirmText, confirmMatches, regenerate, reset } = useConfirmCode();

  return (
    <div style={{ maxWidth: 420 }}>
      <PageGuide tone="danger" className="mb-0 flex flex-col gap-3">
        <div className="erp-u-bold">
          <strong>{tenantName}</strong>의 매출·매입·재고·거래처·계정 등 모든 데이터를 영구히 삭제합니다. 되돌릴 수
          없습니다.
        </div>

        {!code ? (
          <button type="button" onClick={regenerate} className="erp-btn erp-btn-danger erp-u-self-start">
            삭제 진행
          </button>
        ) : (
          <form
            action={formAction}
            className="flex flex-col gap-2"
            onSubmit={() => {
              setConfirmText("");
            }}
          >
            <input type="hidden" name="tenantId" value={tenantId} />
            <label className="flex items-center gap-2 text-xs">
              삭제를 확인하려면 코드 <strong>{code}</strong> 입력
              <input
                type="text"
                inputMode="numeric"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="erp-input"
                style={{ width: 64 }}
                aria-label={`삭제를 확인하려면 ${code}를 입력하세요`}
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={pending || !confirmMatches} className="erp-btn erp-btn-danger erp-u-minw-0">
                {pending ? "삭제 중..." : "영구 삭제"}
              </button>
              <button type="button" onClick={reset} className="erp-btn erp-u-minw-0">
                취소
              </button>
            </div>
          </form>
        )}

        <FormMessage state={state} />
      </PageGuide>
    </div>
  );
}
