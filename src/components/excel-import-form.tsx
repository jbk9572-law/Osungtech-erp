"use client";

import { useActionState, useRef, useState } from "react";
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

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formAction(formData);
        formRef.current?.reset();
        setHasFile(false);
        setResetKey((k) => k + 1);
      }}
      className="flex flex-wrap items-center gap-2"
    >
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
