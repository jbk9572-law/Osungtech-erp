"use client";

import { useActionState } from "react";
import { updateTenantQuota } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";
import { formatMB } from "@/lib/format-bytes";

export function TenantQuotaPanel({
  tenantId,
  dbQuotaBytes,
  fileQuotaBytes,
  dbBytesUsed,
  fileBytesUsed,
}: {
  tenantId: string;
  dbQuotaBytes: number;
  fileQuotaBytes: number;
  dbBytesUsed: number;
  fileBytesUsed: number;
}) {
  const [state, formAction, pending] = useActionState(updateTenantQuota, undefined);

  return (
    <div style={{ maxWidth: 420 }}>
      <PageGuide>
        Standard 요금제 기본값은 DB 50MB / 파일 저장소 1GB입니다. 고객이 운영자 문의로 용량 추가를
        요청하면 여기서 직접 늘려주세요(추후 결제 연동 전까지는 수동 관리).
      </PageGuide>

      <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
        현재 사용량: DB {formatMB(dbBytesUsed)}MB / 파일 저장소 {formatMB(fileBytesUsed)}MB
      </p>

      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="tenantId" value={tenantId} />
        <div className="erp-field">
          <label htmlFor="tq-db">DB 용량 쿼터(MB)</label>
          <input
            id="tq-db"
            type="number"
            name="dbQuotaMb"
            min={1}
            defaultValue={Math.round(dbQuotaBytes / (1024 * 1024))}
            className="erp-input"
            style={{ width: 140 }}
            required
          />
        </div>
        <div className="erp-field">
          <label htmlFor="tq-file">파일 저장소 쿼터(MB)</label>
          <input
            id="tq-file"
            type="number"
            name="fileQuotaMb"
            min={1}
            defaultValue={Math.round(fileQuotaBytes / (1024 * 1024))}
            className="erp-input"
            style={{ width: 140 }}
            required
          />
        </div>
        <div>
          <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ minWidth: 0 }}>
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
        <FormMessage state={state} />
      </form>
    </div>
  );
}
