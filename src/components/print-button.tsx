"use client";

import { useEffect } from "react";

// 새 탭에서 인쇄용 페이지를 연 뒤 "인쇄하기"를 또 눌러야 하는 두 단계
// 미리보기(새 탭 자체 + 인쇄 대화상자)가 번거롭다는 요청으로, 탭이 열리자마자
// 자동으로 인쇄 대화상자를 띄운다 — 그 대화상자 자체가 실제 인쇄 미리보기
// 역할을 한다. 도장 이미지 등이 아직 안 그려진 채로 찍히지 않도록, 페이지
// 로드가 끝난 뒤에 호출한다. 버튼은 대화상자를 취소했을 때 다시 쓸 수
// 있도록 그대로 남겨둔다.
export function PrintButton() {
  useEffect(() => {
    if (document.readyState === "complete") {
      window.print();
      return;
    }
    const handleLoad = () => window.print();
    window.addEventListener("load", handleLoad);
    return () => window.removeEventListener("load", handleLoad);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
    >
      인쇄하기
    </button>
  );
}
