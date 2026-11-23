"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { DocSubmitBar, VoucherTypeBar, useFormSheetClass } from "@/components/erp/voucher-chrome";
import { useModalClose } from "@/lib/modal-context";

// C형 입력 모달의 공용 틀(설정 폼 D형과 같은 12칸 격자) — 제목 줄 · 라벨이 칸 위에 있는 입력 격자 · 하단 바 [취소][저장].
// 입력칸은 children에 `erp-field erp-span-N`으로 넣는다. 화면마다 제목·버튼·메시지를 다시 짜지 않는다(개발헌법 3번).
// 모달 안에서 저장에 성공하면 모달을 닫고 목록으로 돌아간다(H형 규칙). 모달이 아닌 전용 화면에서는 그대로 둔다.
export function ModalFormSheet({
  title,
  tabLabel,
  formRef,
  formAction,
  state,
  pending,
  submitRef,
  submitLabel,
  children,
}: {
  title: string;
  tabLabel: string;
  formRef?: RefObject<HTMLFormElement | null>;
  formAction: (formData: FormData) => void;
  state: FormState;
  pending: boolean;
  submitRef?: RefObject<HTMLButtonElement | null>;
  submitLabel: string;
  children: ReactNode;
}) {
  const sheetClass = useFormSheetClass();
  const close = useModalClose();
  useEffect(() => {
    if (state?.success) close?.();
  }, [state, close]);

  return (
    <form ref={formRef} action={formAction} className={sheetClass}>
      <VoucherTypeBar title={title}>{null}</VoucherTypeBar>
      <div className="erp-detail erp-u-mt-0">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">{tabLabel}</span>
        </div>
        <div className="erp-detail-body erp-field-grid erp-u-border-none erp-u-p-14 erp-u-m-0">{children}</div>
      </div>
      <DocSubmitBar>
        <div className="erp-form-actions">
          <FormMessage state={state} />
          <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
            {pending ? (
              <>
                <span className="erp-spinner" aria-hidden /> 저장 중...
              </>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </DocSubmitBar>
    </form>
  );
}
