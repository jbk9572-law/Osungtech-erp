"use client";

import { createSupplier } from "@/app/(dashboard)/suppliers/actions";
import { PartnerForm } from "@/components/partner-form";

export function CreateSupplierForm() {
  return <PartnerForm action={createSupplier} submitLabel="추가" />;
}
