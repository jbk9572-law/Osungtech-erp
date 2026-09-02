"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { FilePickerInput } from "@/components/file-picker-input";

export function ExcelImportForm({
  action,
  templateHref,
  exportHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  templateHref: string;
  exportHref?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // 실패해도(엑셀을 못 읽음, 데이터 행 없음 등) 제출 즉시 파일 선택이
  // 지워져서, 에러 메시지를 보고 나면 파일을 처음부터 다시 골라야 했다.
  // 성공했을 때만 비운다.
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting local UI state in reaction to a server action result, not derived state
      setHasFile(false);
      setResetKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
      <a href={templateHref} download className="erp-btn">
        ⬇ 템플릿 다운로드
      </a>
      {exportHref && (
        <a href={exportHref} className="erp-btn">
          📥 엑셀로 내보내기
        </a>
      )}
      <FilePickerInput
        key={resetKey}
        name="file"
        accept=".xlsx,.xls"
        required
        icon="📊"
        label="엑셀 파일 선택"
        onFileChange={(f) => setHasFile(!!f)}
      />
      <button type="submit" disabled={pending || !hasFile} className="erp-btn erp-btn-primary">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 업로드 중...
          </>
        ) : (
          "엑셀로 일괄등록"
        )}
      </button>
      <div className="basis-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
