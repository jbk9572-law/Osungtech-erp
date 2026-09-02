"use client";

import { useActionState, useState } from "react";
import { restoreBackup } from "@/app/(dashboard)/settings/backup/actions";
import { FormMessage } from "@/components/form-message";
import { useConfirmCode } from "@/lib/use-confirm-code";

// 복원은 되돌릴 수 없는 쓰기 작업이라(이미 있는 데이터는 안 건드리지만
// 새 데이터는 실제로 DB에 들어간다), 삭제 버튼과 같은 확인 코드 입력
// 방식을 그대로 쓴다 — 파일을 고르는 순간 코드를 새로 뽑아서, 실수로
// 엔터만 눌러 바로 실행되는 일이 없게 한다.
export function BackupRestoreForm() {
  const [state, formAction, pending] = useActionState(restoreBackup, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const { code, confirmText, setConfirmText, confirmMatches, regenerate, reset } = useConfirmCode();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={() => {
        setConfirmText("");
      }}
    >
      <div className="erp-field">
        <label htmlFor="backup-file">백업 파일 선택 (.json)</label>
        <input
          id="backup-file"
          type="file"
          name="file"
          accept="application/json"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFileName(f ? f.name : null);
            if (f) regenerate();
            else reset();
          }}
          className="erp-input"
        />
      </div>

      {fileName && code && (
        <label
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--erp-text-muted)" }}
        >
          <strong style={{ color: "var(--erp-text)" }}>{fileName}</strong> 복원을 확인하려면 코드{" "}
          <strong>{code}</strong> 입력
          <input
            type="text"
            inputMode="numeric"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="erp-input"
            style={{ width: 64 }}
            aria-label={`복원을 확인하려면 ${code}를 입력하세요`}
          />
        </label>
      )}

      <div>
        <button
          type="submit"
          disabled={pending || !confirmMatches}
          className="erp-btn erp-btn-danger"
          style={{ minWidth: 0 }}
        >
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 복원 중...
            </>
          ) : (
            "복원하기"
          )}
        </button>
      </div>

      <FormMessage state={state} />
    </form>
  );
}
