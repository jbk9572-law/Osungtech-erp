import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PartnerForm } from "@/components/partner-form";
import { DeleteButton } from "@/components/delete-button";
import { updateSupplier, deleteSupplier } from "@/app/(dashboard)/suppliers/actions";

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
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">{supplier.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        {supplier.business_number ?? "사업자번호 미등록"} · {supplier.contact_name ?? "담당자 미등록"}
      </p>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">공급업체 정보 수정</h2>
          <DeleteButton
            action={deleteSupplier}
            id={supplier.id}
            confirmMessage="이 공급업체를 삭제하시겠습니까? 관련 매입/상품 내역이 있으면 삭제되지 않습니다."
          />
        </div>
        <PartnerForm action={updateSupplier} idFieldValue={supplier.id} initial={supplier} submitLabel="저장" />
      </div>
    </div>
  );
}
