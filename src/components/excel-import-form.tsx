"use client";

import { useActionState, useRef } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";

export function ExcelImportForm({
  action,
  templateHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  templateHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <a href={templateHref} download className="erp-btn">
        템플릿 다운로드
      </a>
      <input type="file" name="file" accept=".xlsx,.xls" required className="erp-input" style={{ maxWidth: 280 }} />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
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
