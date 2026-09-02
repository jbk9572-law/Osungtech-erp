"use client";

import { useActionState, useState } from "react";
import { restoreFromServerSnapshot } from "@/app/(dashboard)/settings/backup/actions";
import { FormMessage } from "@/components/form-message";
import { useConfirmCode } from "@/lib/use-confirm-code";

// 위 "복원하기"(안전한 병합 복원)와 달리 이건 DB를 통째로 지우고 백업
// 시점 그대로 되돌리는 파괴적 작업이라, 같은 확인 코드 방식이라도 시점을
// 고르는 순간 코드를 새로 뽑는다 — 다른 시점으로 바꿔 골랐는데 이전에
// 외웠던 코드를 그대로 치는 실수를 막기 위함.
export function ServerRestoreForm({ snapshots }: { snapshots: string[] }) {
  const [state, formAction, pending] = useActionState(restoreFromServerSnapshot, undefined);
  const [snapshot, setSnapshot] = useState("");
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
        <label htmlFor="restore-snapshot">복원할 시점</label>
        <select
          id="restore-snapshot"
          name="snapshot"
          required
          value={snapshot}
          onChange={(e) => {
            const v = e.target.value;
            setSnapshot(v);
            if (v) regenerate();
            else reset();
          }}
          className="erp-input"
        >
          <option value="">시점 선택...</option>
          {snapshots.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {snapshot && code && (
        <label
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--erp-text-muted)" }}
        >
          <strong style={{ color: "var(--erp-text)" }}>{snapshot}</strong> 시점으로 DB 전체를
          되돌리려면 코드 <strong>{code}</strong> 입력
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
              <span className="erp-spinner" aria-hidden /> 복원 요청 중...
            </>
          ) : (
            "이 시점으로 서버에서 복원"
          )}
        </button>
      </div>

      <FormMessage state={state} />
    </form>
  );
}
