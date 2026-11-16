"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/components/form-message";
import { startRouteProgress } from "@/lib/route-progress";
import { useModalClose } from "@/lib/modal-context";
import { subscribeNavStart } from "@/lib/nav-start";

// 서버 액션이 저장 성공 후 이동할 경로를 state.redirectTo로 돌려주면,
// 여기서 클라이언트 라우터로 이동시킨다. 서버 액션 안에서 직접
// redirect()를 부르면 모달(인터셉트 라우트)로 열려 있던 폼이 항상 전체
// 페이지로 튕겨나가버리는 Next.js 제약을 피하기 위한 공용 훅 — 등록/수정
// 폼마다 각자 구현하지 않고 이 훅 하나로 통일한다.
export function useFormRedirect(state: FormState) {
  const router = useRouter();
  // 모달 안에서 저장 후 이동하면 push가 아니라 replace — 쌓아 두면 브라우저 "뒤로가기"가 이미 저장한 입력 모달을 다시 연다.
  const inModal = useModalClose() !== null;
  // 저장이 끝나기 전에 사용자가 홈·탭·메뉴로 먼저 이동을 시작했다면, 저장이 뒤늦게 끝났다고 그 이동을 덮어쓰지 않는다
  // (저장은 이미 서버에 반영됐다 — 따로 이동만 건너뛴다). 제출할 때마다 "아직 안 떠났음"으로 되돌린다.
  const leftRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeNavStart(() => {
      leftRef.current = true;
    });
    const onSubmit = () => {
      leftRef.current = false;
    };
    document.addEventListener("submit", onSubmit, true);
    return () => {
      unsubscribe();
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  useEffect(() => {
    if (!state?.redirectTo) return;
    if (leftRef.current) return;
    startRouteProgress();
    if (inModal) router.replace(state.redirectTo);
    else router.push(state.redirectTo);
  }, [state, router, inModal]);
}
