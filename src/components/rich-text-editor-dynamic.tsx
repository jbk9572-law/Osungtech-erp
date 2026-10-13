"use client";

import dynamic from "next/dynamic";

// TipTap(@tiptap/* 12개 패키지)이 공지사항/전자결재/고객지원/공문관리
// "목록" 화면에도 정적으로 묶여 들어가 있었다 — 그 화면들은 대부분
// 읽기만 하고 들어가는데(글쓰기 폼은 그 중 일부에서만 열림), 에디터를
// 한 번도 안 띄워도 전체 TipTap 번들을 다운로드하고 있었다. 실제로
// 에디터가 화면에 뜰 때만 불러오도록 지연 로딩한다(paper-calc-print-
// dynamic.tsx와 같은 패턴).
export const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="erp-input"
        style={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--erp-text-muted)", fontSize: 12 }}
      >
        에디터 불러오는 중...
      </div>
    ),
  },
);
