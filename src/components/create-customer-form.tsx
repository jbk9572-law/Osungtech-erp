"use client";

import { createCustomer } from "@/app/(dashboard)/customers/actions";
import { PartnerForm } from "@/components/partner-form";

export function CreateCustomerForm() {
  return <PartnerForm action={createCustomer} showDocumentType submitLabel="추가" />;
}
