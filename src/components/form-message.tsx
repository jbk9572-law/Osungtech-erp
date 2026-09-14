export type FormState =
  | {
      error?: string;
      success?: string;
      // 저장 성공 후 이동할 경로. 서버 액션에서 redirect()를 직접 부르면
      // 모달(인터셉트 라우트) 컨텍스트를 벗어나 항상 전체 페이지로
      // 튕겨나가므로(Next.js의 알려진 제약 — 서버 액션의 redirect()는
      // 소프트 네비게이션으로 취급되지 않는다), 대신 이 값을 반환하고
      // 클라이언트에서 useFormRedirect 훅으로 router.push()한다.
      redirectTo?: string;
    }
  | undefined;

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;

  return (
    <p
      className={`rounded-sm px-3 py-2 text-xs font-medium ${
        state.error
          ? "bg-[var(--erp-danger-bg)] text-[var(--erp-danger)]"
          : "bg-[var(--erp-success-bg)] text-[var(--erp-success)]"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}
