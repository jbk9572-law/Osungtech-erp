"use client";

import { useActionState } from "react";
import { resetSandbox, seedSandbox } from "@/app/(dashboard)/settings/sandbox/actions";
import { FormMessage } from "@/components/form-message";
import { useConfirmCode } from "@/lib/use-confirm-code";
import { PageGuide } from "@/components/erp/page-guide";

export function SandboxTools() {
  const [resetState, resetAction, resetPending] = useActionState(resetSandbox, undefined);
  const [seedState, seedAction, seedPending] = useActionState(seedSandbox, undefined);
  const { code, confirmText, setConfirmText, confirmMatches, regenerate, reset } = useConfirmCode();

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 480 }}>
      <div className="erp-field">
        <label>더미 데이터 생성</label>
        <PageGuide className="mb-2">
          창고 1곳, 매입처 5곳, 거래처 8곳, 품목 15개를 만들고, 최근 45일에 걸쳐 매입 15건·매출 30건을 랜덤하게
          생성합니다 — 재고현황/FIFO 원가/매출·매입 목록이 실제 업무 화면처럼 채워집니다.
        </PageGuide>
        <form action={seedAction}>
          <button type="submit" disabled={seedPending} className="erp-btn erp-btn-primary">
            {seedPending ? "생성 중..." : "더미 데이터 생성"}
          </button>
        </form>
        <FormMessage state={seedState} />
      </div>

      <div className="erp-field">
        <label>초기화</label>
        <PageGuide tone="danger" className="mb-2">
          로그인 계정을 뺀 모든 데이터를 지우고 빈 상태로 되돌립니다. 되돌릴 수 없습니다.
        </PageGuide>
        {!code ? (
          <button type="button" onClick={regenerate} className="erp-btn erp-btn-danger">
            초기화 진행
          </button>
        ) : (
          <form
            action={resetAction}
            className="flex flex-col gap-2"
            onSubmit={() => {
              setConfirmText("");
            }}
          >
            <label className="flex items-center gap-2 text-xs">
              초기화를 확인하려면 코드 <strong>{code}</strong> 입력
              <input
                type="text"
                inputMode="numeric"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="erp-input"
                style={{ width: 64 }}
                aria-label={`초기화를 확인하려면 ${code}를 입력하세요`}
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={resetPending || !confirmMatches} className="erp-btn erp-btn-danger" style={{ minWidth: 0 }}>
                {resetPending ? "초기화 중..." : "초기화 실행"}
              </button>
              <button type="button" onClick={reset} className="erp-btn" style={{ minWidth: 0 }}>
                취소
              </button>
            </div>
          </form>
        )}
        <FormMessage state={resetState} />
      </div>
    </div>
  );
}
