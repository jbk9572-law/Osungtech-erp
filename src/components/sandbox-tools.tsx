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
          창고 2곳/부서 4곳/매입처 15곳/거래처 20곳/품목 24개를 만들고, 매입 300건·매출 600건(+반품 60건,
          이월·샘플·면세 등 포함)·수금 120건·구매요청서 8건·구매견적요청 5건·견적서 10건·지급결의서
          4건·매입처 지급내역 40건·공지사항 8건·사내메신저 대화·할일 5건·사원 계정 6명까지 한 번에 채웁니다.
          재고위험/마이너스재고/선수금/대형 단일 거래/만료된 견적서 같은 엣지 케이스도 몇 건씩 섞어 넣어서
          화면 구석구석을 바로 확인할 수 있습니다. 메일함은 실제 외부 이메일 계정 연동이 필요해 더미로 채울 수
          없어 제외됩니다. 거래 건수가 많아 생성에 몇 초 정도 걸릴 수 있습니다.
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
