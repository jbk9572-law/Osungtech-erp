import { redirect } from "next/navigation";

// 예전 별도 화면(임시저장함)을 기안함의 "임시저장" 탭으로 합쳤다 — 이
// 경로로 들어오는 기존 북마크/링크는 그 탭으로 보낸다.
export default function ApprovalDraftsRedirect() {
  redirect("/approvals?status=draft");
}
