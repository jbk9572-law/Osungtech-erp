"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useModalClose } from "@/lib/modal-context";

// 상세 화면(모달·페이지 공통) 맨 아래에 붙는 고정 바 — 왼쪽에 [삭제](빨간 테두리), 오른쪽에 [닫기].
// 예전엔 [삭제]가 내용 맨 윗줄 오른쪽 끝에 있어 모달의 ✕ 자리와 겹치고, 아래로 스크롤하면 사라졌다.
// 바는 스크롤해도 모달 맨 아래에 그대로 남는다(position: sticky). 저장은 각 폼이 자기 안에 갖는다.
export function DetailActionBar({ closeHref, children }: { closeHref: string; children?: ReactNode }) {
  const closeModal = useModalClose();
  return (
    <div className="erp-detail-actionbar">
      <div className="erp-detail-actionbar-main">{children}</div>
      {closeModal ? (
        <button type="button" className="erp-btn" onClick={closeModal}>
          닫기
        </button>
      ) : (
        <Link href={closeHref} className="erp-btn">
          닫기
        </Link>
      )}
    </div>
  );
}
