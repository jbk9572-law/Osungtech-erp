"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";

export type WithholdingBracketValues = {
  id?: string;
  salary_from: number;
  salary_to: number | null;
  dependents_1: number;
  dependents_2: number;
  dependents_3: number;
  dependents_4: number;
  dependents_5: number;
  dependents_6: number;
  dependents_7: number;
  dependents_8: number;
  dependents_9: number;
  dependents_10: number;
  dependents_11: number;
};

const EMPTY: WithholdingBracketValues = {
  salary_from: 0,
  salary_to: null,
  dependents_1: 0,
  dependents_2: 0,
  dependents_3: 0,
  dependents_4: 0,
  dependents_5: 0,
  dependents_6: 0,
  dependents_7: 0,
  dependents_8: 0,
  dependents_9: 0,
  dependents_10: 0,
  dependents_11: 0,
};

// 구간 하나(월급여 이상/미만 + 부양가족 1~11명 세액)를 추가하거나
// 수정한다. CSV 일괄 업로드가 기본 경로고, 이 폼은 업로드 후 한두 구간만
// 손보거나 구간을 새로 끼워 넣을 때 쓰는 보조 수단이라 굳이 표 안에
// 인라인으로 두지 않고 폼 하나를 위/아래로 재사용한다(수정 대상을
// 고르면 이 폼에 그 값이 채워지는 방식) — withholding-brackets-manager.tsx
// 참고.
export function WithholdingBracketForm({
  action,
  initial,
  onCancel,
  onSaved,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initial?: WithholdingBracketValues;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const v = initial ?? EMPTY;

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      onSaved?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장 성공(state) 변화에만 반응한다
  }, [state]);

  return (
    <form ref={formRef} action={formAction} onKeyDown={preventEnterSubmit} className="grid grid-cols-1 gap-2">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div className="flex flex-wrap items-end gap-2">
        <div className="erp-field">
          <label htmlFor="wb-from">월급여 이상</label>
          <input
            id="wb-from"
            type="number"
            name="salary_from"
            step="1"
            min="0"
            defaultValue={v.salary_from}
            className="erp-input"
            style={{ width: 120 }}
            required
          />
        </div>
        <div className="erp-field">
          <label htmlFor="wb-to">월급여 미만 (비우면 최고구간)</label>
          <input
            id="wb-to"
            type="number"
            name="salary_to"
            step="1"
            min="0"
            defaultValue={v.salary_to ?? ""}
            className="erp-input"
            style={{ width: 120 }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
          <div key={n} className="erp-field">
            <label htmlFor={`wb-dep-${n}`}>{n}명</label>
            <input
              id={`wb-dep-${n}`}
              type="number"
              name={`dependents_${n}`}
              step="1"
              min="0"
              defaultValue={v[`dependents_${n}` as keyof WithholdingBracketValues] as number}
              className="erp-input"
              style={{ width: 80 }}
              required
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ height: 30 }}>
          {pending ? "저장 중..." : v.id ? "수정 저장" : "구간 추가"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="erp-btn" style={{ height: 30 }}>
            취소
          </button>
        )}
        <FormMessage state={state} />
      </div>
    </form>
  );
}
