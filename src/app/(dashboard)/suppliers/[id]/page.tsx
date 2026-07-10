import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PartnerForm } from "@/components/partner-form";
import { DeleteButton } from "@/components/delete-button";
import { updateSupplier, deleteSupplier } from "@/app/(dashboard)/suppliers/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: supplier } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();

  if (!supplier) {
    notFound();
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/suppliers" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">{supplier.name}</h1>
        <Link href="/suppliers" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[#6b7280]">
        {supplier.business_number ?? "사업자번호 미등록"} · {supplier.contact_name ?? "담당자 미등록"}
      </p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs" style={{ justifyContent: "space-between" }}>
          <span className="erp-detail-tab active">공급업체 정보 수정</span>
          <div style={{ margin: 4 }}>
            <DeleteButton
              action={deleteSupplier}
              id={supplier.id}
              confirmMessage="이 공급업체를 삭제하시겠습니까? 관련 매입/상품 내역이 있으면 삭제되지 않습니다."
            />
          </div>
        </div>
        <div className="erp-detail-body">
          <PartnerForm
            action={updateSupplier}
            idFieldValue={supplier.id}
            initial={supplier}
            submitLabel="저장"
          />
        </div>
      </div>
    </div>
  );
}
