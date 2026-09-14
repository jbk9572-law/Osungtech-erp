"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useModalClose } from "@/lib/modal-context";

// "ESC 닫기" 버튼 공용 컴포넌트. 일반 전체 화면에서는 href로 이동하고,
// 모달(인터셉트 라우트)로 열려 있을 때는 그 모달의 닫기 함수(뒤로가기)를
// 그대로 쓴다 — href로 다시 이동을 걸면 이미 열려 있던 배경 화면을 서버에
// 새로 요청하게 되어, 그 요청이 느리거나 걸리면 화면이 멈춘 것처럼
// 보이는 문제가 있었다.
export function CloseButton({
  href,
  children = "ESC 닫기",
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
