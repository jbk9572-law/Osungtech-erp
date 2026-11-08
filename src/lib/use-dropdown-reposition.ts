"use client";

import { useEffect } from "react";

// 자체완성 드롭다운(PartySearchSelect/ProductSearchSelect/
// QuickAddProductSearch 공통 패턴)은 document.body에 포털로 띄우고
// position:fixed 좌표를 focus 시점에 한 번만 계산해 둔다 — 그 뒤 페이지나
// 부모 패널(.erp-split-detail, .erp-page 등)이 스크롤되거나 창 크기가
// 바뀌어도 좌표가 그대로라, 입력칸은 움직이는데 드롭다운만 원래 화면
// 좌표에 남아 둘이 따로 떨어져 버린다(사용자 지적 — "입력폼... 겹침
// 문제", Playwright로 재현 확인된 버그). 열려 있는 동안만 스크롤/리사이즈를
// 감지해서 호출자가 넘긴 reposition()으로 좌표를 다시 계산한다.
// 캡처 단계로 등록해야 자식 스크롤 컨테이너의 스크롤도 같이 잡힌다
// (scroll 이벤트는 버블되지 않아서 window에 버블 단계로만 걸면 못 듣는다).
export function useDropdownReposition(open: boolean, reposition: () => void) {
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);
}
