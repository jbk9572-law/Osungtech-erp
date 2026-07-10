import Link from "next/link";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default function PaperCalcPage() {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">확장모듈 &gt; 모조지 계산</h1>
        <Link href="/dashboard" className="erp-btn">
          ESC 닫기
        </Link>
      </div>
      <div className="erp-detail" style={{ marginTop: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">준비 중</span>
        </div>
        <div className="erp-detail-body">
          <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
            모조지 계산 기능은 아직 연결 전입니다. 계산 방식(입력 항목, 계산식, 결과 표시)을
            확인한 뒤 이 화면에 실제 기능을 구현할 예정입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
