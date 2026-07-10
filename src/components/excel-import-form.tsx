"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { formatFileSize } from "@/lib/file-display";

export function ExcelImportForm({
  action,
  templateHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  templateHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formAction(formData);
        formRef.current?.reset();
        setFile(null);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <a href={templateHref} download className="erp-btn">
        템플릿 다운로드
      </a>
      <label className="erp-file-picker">
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".xlsx,.xls"
          required
          className="erp-file-picker-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFile(f ? { name: f.name, size: f.size } : null);
          }}
        />
        <span className="erp-file-picker-btn">📊 파일 선택</span>
      </label>
      {file && (
        <span className="erp-file-picker-name">
          {file.name} · {formatFileSize(file.size)}
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="erp-file-picker-clear"
            aria-label="선택 취소"
          >
            ✕
          </button>
        </span>
      )}
      <button type="submit" disabled={pending || !file} className="erp-btn erp-btn-primary">
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
