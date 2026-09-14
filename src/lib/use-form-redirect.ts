import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/components/form-message";
import { startRouteProgress } from "@/lib/route-progress";

// 서버 액션이 저장 성공 후 이동할 경로를 state.redirectTo로 돌려주면,
// 여기서 클라이언트 라우터로 이동시킨다. 서버 액션 안에서 직접
// redirect()를 부르면 모달(인터셉트 라우트)로 열려 있던 폼이 항상 전체
// 페이지로 튕겨나가버리는 Next.js 제약을 피하기 위한 공용 훅 — 등록/수정
// 폼마다 각자 구현하지 않고 이 훅 하나로 통일한다.
export function useFormRedirect(state: FormState) {
  const router = useRouter();

  useEffect(() => {
    if (!state?.redirectTo) return;
    startRouteProgress();
    router.push(state.redirectTo);
  }, [state, router]);
}
