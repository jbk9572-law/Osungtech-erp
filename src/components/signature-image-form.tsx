"use client";

import { useActionState, useState } from "react";
import { uploadSignatureImage, resetSignatureImage } from "@/app/(dashboard)/settings/signature/actions";
import { FormMessage } from "@/components/form-message";
import { FilePickerInput } from "@/components/file-picker-input";

export function SignatureImageForm({ currentUrl }: { currentUrl?: string | null }) {
  const [state, formAction, pending] = useActionState(uploadSignatureImage, undefined);
  const [resetState, resetAction, resetPending] = useActionState(resetSignatureImage, undefined);
  const [hasFile, setHasFile] = useState(false);

  return (
    <div className="rounded-sm border border-[var(--erp-divider)] p-4" style={{ maxWidth: 420 }}>
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- 사용자가 직접 올린 임의 크기 이미지라 next/image 최적화 대상이 아니다
        <img src={currentUrl} alt="내 서명" className="mb-3" style={{ height: 48, width: "auto" }} />
      ) : (
        <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
          등록된 서명 이미지가 없습니다.
        </p>
      )}
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <FilePickerInput name="file" accept="image/*" required icon="✍️" label="서명 이미지 선택" onFileChange={(f) => setHasFile(!!f)} />
        <button type="submit" disabled={pending || !hasFile} className="erp-btn" style={{ minWidth: 0 }}>
          {pending ? "업로드 중..." : currentUrl ? "교체" : "등록"}
        </button>
      </form>
      {currentUrl && (
        <form action={resetAction} className="mt-2">
          <button type="submit" disabled={resetPending} className="erp-btn erp-btn-danger" style={{ minWidth: 0 }}>
            {resetPending ? "삭제하는 중..." : "서명 삭제"}
          </button>
        </form>
      )}
      <div className="mt-2">
        <FormMessage state={state} />
        <FormMessage state={resetState} />
      </div>
    </div>
  );
}
