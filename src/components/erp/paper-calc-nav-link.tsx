"use client";

import Link from "next/link";
import { useModalClose } from "@/lib/modal-context";

// 모조지 계산/재단 배치 시뮬레이터로 가는 링크 — 이제 /paper-calc,
// /paper-calc/manual 둘 다 @modal 인터셉트 라우트가 있어서 일반 화면에서
// 누르면 자동으로 모달로 뜬다. 다만 이 링크 자체가 이미 모달(매출/매입
// 등록 폼 등) 안에서 렌더링되는 경우엔 얘기가 다르다 — Next.js가 이미 열려
// 있는 @modal 슬롯 내용을 이 새 인터셉트 라우트로 통째로 갈아치워버려서
// 지금 작성 중이던 폼이 사라지는 것처럼 보일 수 있다(검증 안 된 중첩
// 모달 상황). 그래서 이미 모달 안이면(useModalClose()가 non-null) 예전처럼
// 새 탭으로 열어 안전하게 피하고, 모달 밖의 일반 화면에서만 인터셉트가
// 자연스럽게 걸리는 모달 이동을 쓴다.
export function PaperCalcNavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const insideModal = useModalClose() !== null;

  if (insideModal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
