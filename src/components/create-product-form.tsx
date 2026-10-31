"use client";

import { createProduct } from "@/app/(dashboard)/products/actions";
import { ProductForm } from "@/components/product-form";

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };
type ParentCandidate = { id: string; sku: string; name: string; spec?: string | null };

export function CreateProductForm({
  categories,
  suppliers,
  parentCandidates = [],
}: {
  categories: Category[];
  suppliers: Supplier[];
  parentCandidates?: ParentCandidate[];
}) {
  return (
    <ProductForm
      action={createProduct}
      categories={categories}
      suppliers={suppliers}
      submitLabel="추가"
      parentCandidates={parentCandidates}
    />
  );
}
