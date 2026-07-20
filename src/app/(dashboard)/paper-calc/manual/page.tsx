import Link from "next/link";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ManualLayoutClient } from "@/components/paper-calc/manual-layout-client";

export default function PaperCalcManualPage() {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/paper-calc" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">확장모듈 &gt; 재단 배치 시뮬레이터</h1>
        <Link href="/paper-calc" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <div style={{ marginTop: 12 }}>
        <ManualLayoutClient />
      </div>
    </div>
  );
}
