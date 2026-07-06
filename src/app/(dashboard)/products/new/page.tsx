import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import { createProduct } from "@/app/(dashboard)/products/actions";

export default async function NewProductPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: suppliers }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>품목 신규 등록</h1>
      <ProductForm
        action={createProduct}
        categories={categories ?? []}
        suppliers={suppliers ?? []}
        submitLabel="등록"
      />
    </div>
  );
}
