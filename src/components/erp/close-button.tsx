"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useModalClose } from "@/lib/modal-context";

// 닫기 버튼 공용 컴포넌트. 일반 전체 화면에서는 href로 이동하고,
// 모달(인터셉트 라우트)로 열려 있을 때는 그 모달의 닫기 함수(뒤로가기)를
// 그대로 쓴다 — href로 다시 이동을 걸면 이미 열려 있던 배경 화면을 서버에
// 새로 요청하게 되어, 그 요청이 느리거나 걸리면 화면이 멈춘 것처럼
// 보이는 문제가 있었다. 라벨은 "✕" — 예전엔 "ESC 닫기"라고 써놨는데
// 마우스로 클릭하는 버튼에 키보드 키 이름을 적어놓은 게 헷갈린다는
// 지적으로 바꿨다(물리 ESC 키는 이 버튼과 별개로 계속 동작한다 —
// keyboard-shortcuts.tsx). 매출/매입 등록·수정 폼에서는 물리 ESC 키가
// "저장 후 닫기"로 바뀌었지만(new-sale-form.tsx/new-purchase-form.tsx),
// 이 버튼은 그 화면에서도 여전히 저장 없이 즉시 닫는 별도 동작이다.
export function CloseButton({
  href,
  children = "✕",
  className = "erp-btn erp-btn-dark",
}: {
  href: string;
  children?: ReactNode;
  className?: string;
}) {
  const closeModal = useModalClose();

  if (closeModal) {
    return (
      <button type="button" className={className} onClick={closeModal}>
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
