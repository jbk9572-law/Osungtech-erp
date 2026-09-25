import { redirect } from "next/navigation";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ManualLayoutClient } from "@/components/paper-calc/manual-layout-client";
import { createClient } from "@/lib/supabase/server";
import { isPaperCalcEnabled } from "@/lib/paper-calc-sync";

export default async function PaperCalcManualPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string }>;
}) {
  const { for: pendingFor } = await searchParams;
  // paper-calc/page.tsx와 동일한 이유로, URL 직접 접근까지 막는다.
  if (!(await isPaperCalcEnabled(await createClient()))) {
    redirect("/dashboard");
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/paper-calc" } }} />
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">확장모듈 &gt; 재단 배치 시뮬레이터</h1>
      <div style={{ marginTop: 12 }}>
        <ManualLayoutClient pendingFor={pendingFor === "purchase" ? "purchase" : "sales"} />
      </div>
    </div>
  );
}
