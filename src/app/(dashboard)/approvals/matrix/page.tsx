import { redirect } from "next/navigation";

// 예전 별도 화면(결재매트릭스)을 공유 결재선 화면의 탭으로 합쳤다 — 이
// 경로로 들어오는 기존 북마크/링크는 그 탭으로 보낸다.
export default function ApprovalMatrixRedirect() {
  redirect("/approvals/lines?tab=matrix");
}
