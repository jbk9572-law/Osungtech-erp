"use client";

import { createProduct } from "@/app/(dashboard)/products/actions";
import { ProductForm } from "@/components/product-form";

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

export function CreateProductForm({
  categories,
  suppliers,
}: {
  categories: Category[];
  suppliers: Supplier[];
}) {
  return (
    <ProductForm action={createProduct} categories={categories} suppliers={suppliers} submitLabel="추가" />
  );
}
