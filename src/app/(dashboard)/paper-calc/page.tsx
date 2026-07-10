import Link from "next/link";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PaperCalcClient } from "@/components/paper-calc/paper-calc-client";

export default function PaperCalcPage() {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">확장모듈 &gt; 모조지 계산</h1>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <div style={{ marginTop: 12 }}>
        <PaperCalcClient />
      </div>
    </div>
  );
}
