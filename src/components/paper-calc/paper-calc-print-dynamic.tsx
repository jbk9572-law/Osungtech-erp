"use client";

import dynamic from "next/dynamic";

// sessionStorage로 넘어온 계산 결과를 읽어야 해서 브라우저에서만 렌더링한다.
// (`ssr: false`는 클라이언트 컴포넌트 안에서만 쓸 수 있어서 이 얇은
// 래퍼로 분리했다.)
const PaperCalcPrintView = dynamic(
  () => import("@/components/paper-calc/paper-calc-print-view").then((m) => m.PaperCalcPrintView),
  { ssr: false }
);

export default PaperCalcPrintView;
