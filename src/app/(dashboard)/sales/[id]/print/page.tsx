import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { DeliveryNoteDoc } from "@/components/delivery-note-doc";
import {
  SnsFiltechCanvas,
  ZenithTechCanvas,
  KtSolutionCanvas,
} from "@/components/delivery-note-v2/DeliveryNoteCanvas";
import { InvoicePage, type InvoiceCopies } from "@/components/invoice/InvoicePage";

export default async function SalesPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string }>;
}) {
  const { id } = await params;
  const { copies: copiesParam } = await searchParams;
  const copies: InvoiceCopies =
    copiesParam === "receiver" || copiesParam === "supplier" ? copiesParam : "both";
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: company }] = await Promise.all([
    supabase.from("sales_orders").select("*, customers(*)").eq("id", id).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("*, products(sku, name, spec, unit, base_package_qty, categories(name))")
      .eq("sales_order_id", id)
      .order("created_at"),
    supabase.from("company_profile").select("*").eq("id", 1).maybeSingle(),
  ]);

  if (!order) {
    notFound();
  }

  const docType = order.customers?.document_type ?? "명세표";
  const docNumber = String(order.doc_no);

  if (docType === "출고증") {
    const variant = order.customers?.delivery_note_variant ?? null;

    // sns_filtech: 실제 PDF 벡터 좌표를 그대로 옮긴 정밀 재현 버전.
    // 그 외 변형은 아직 구조적 근사치(DeliveryNoteDoc)를 사용한다.
    if (variant === "sns_filtech") {
      const canvasItems = (items ?? []).map((item) => ({
        id: item.id,
        category: item.products?.categories?.name ?? "",
        productName: item.products?.name ?? "",
        spec: item.spec || item.products?.spec || "",
        sku: item.products?.sku ?? "",
        unit: item.products?.unit ?? "",
        quantity: item.quantity,
        basePackageQty: item.products?.base_package_qty != null ? Number(item.products.base_package_qty) : null,
      }));

      return (
        <div className="mx-auto print:mx-0" style={{ width: "595.32pt" }}>
          <div className="mb-4 flex items-center justify-between print:hidden">
            <Link href="/sales" className="erp-btn erp-btn-danger">
              목록으로
            </Link>
            <PrintButton />
          </div>
          <SnsFiltechCanvas
            company={company}
            customerName={order.customers?.name ?? ""}
            customerAddress={order.customers?.address ?? null}
            customerContactName={order.customers?.contact_name ?? null}
            customerContactPhone={order.customers?.phone ?? null}
            orderDate={order.order_date}
            items={canvasItems}
            note={order.memo}
          />
        </div>
      );
    }

    if (variant === "zenith_tech") {
      // 제니스테크는 규격 칸에 품목명과 규격을 같이 보여준다("품목명 / 규격").
      const canvasItems = (items ?? []).map((item) => ({
        id: item.id,
        category: item.products?.categories?.name ?? "",
        productName: item.products?.name ?? "",
        spec: item.spec || item.products?.spec || "",
        sku: item.products?.sku ?? "",
        unit: item.products?.unit ?? "",
        quantity: item.quantity,
        basePackageQty: item.products?.base_package_qty != null ? Number(item.products.base_package_qty) : null,
      }));

      return (
        <div className="mx-auto print:mx-0" style={{ width: "595.32pt" }}>
          <div className="mb-4 flex items-center justify-between print:hidden">
            <Link href="/sales" className="erp-btn erp-btn-danger">
              목록으로
            </Link>
            <PrintButton />
          </div>
          <ZenithTechCanvas
            company={company}
            customerName={order.customers?.name ?? ""}
            customerAddress={order.customers?.address ?? null}
            customerContactName={order.customers?.contact_name ?? null}
            customerContactPhone={order.customers?.phone ?? null}
            orderDate={order.order_date}
            items={canvasItems}
            note={order.memo}
          />
        </div>
      );
    }

    if (variant === "ket_solution") {
      // 케이이티솔루션은 주문 등록 시 "규격" 입력칸에 실제 규격 대신 배치/롯
      // 관리번호(예: 260521 - 101)를 적기 때문에, 규격은 품목 마스터의 고정
      // 값을 쓰고 사용자가 입력한 값은 관리번호로 보여준다.
      const canvasItems = (items ?? []).map((item) => ({
        id: item.id,
        category: item.products?.categories?.name ?? "",
        productName: item.products?.name ?? "",
        spec: item.products?.spec || "",
        sku: item.products?.sku ?? "",
        unit: item.products?.unit ?? "",
        quantity: item.quantity,
        basePackageQty: item.products?.base_package_qty != null ? Number(item.products.base_package_qty) : null,
        lotNo: item.spec || null,
      }));

      return (
        <div className="mx-auto print:mx-0" style={{ width: "595.32pt" }}>
          <div className="mb-4 flex items-center justify-between print:hidden">
            <Link href="/sales" className="erp-btn erp-btn-danger">
              목록으로
            </Link>
            <PrintButton />
          </div>
          <KtSolutionCanvas
            company={company}
            customerName={order.customers?.name ?? ""}
            customerAddress={order.customers?.address ?? null}
            customerContactName={order.customers?.contact_name ?? null}
            customerContactPhone={order.customers?.phone ?? null}
            orderDate={order.order_date}
            items={canvasItems}
            note={order.memo}
          />
        </div>
      );
    }

    const deliveryItems = (items ?? []).map((item) => ({
      id: item.id,
      category: item.products?.categories?.name ?? "",
      productName: item.products?.name ?? "",
      spec: item.spec || item.products?.spec || "",
      sku: item.products?.sku ?? "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
    }));

    return (
      <div className="mx-auto max-w-3xl print-page-wrapper">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link href="/sales" className="erp-btn erp-btn-danger">
            목록으로
          </Link>
          <PrintButton />
        </div>
        <DeliveryNoteDoc
          company={company}
          customerName={order.customers?.name ?? ""}
          customerAddress={order.customers?.address ?? null}
          customerContactName={order.customers?.contact_name ?? null}
          customerContactPhone={order.customers?.phone ?? null}
          orderDate={order.order_date}
          items={deliveryItems}
          note={order.memo}
          variant={variant}
        />
      </div>
    );
  }

  const invoiceItems = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    const d = new Date(order.order_date);
    return {
      id: item.id,
      monthDay: `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
      productLabel: (() => {
        const name = item.products?.name ?? "";
        const spec = item.spec || item.products?.spec;
        return spec ? `${name}/${spec}` : name;
      })(),
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      supplyAmount,
      taxAmount,
    };
  });

  return (
    <div className="mx-auto max-w-5xl print:mx-0 print:max-w-none print-page-wrapper">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/sales" className="erp-btn erp-btn-danger">
          목록으로
        </Link>
        <div className="flex gap-1 rounded-md border border-gray-200 p-1 text-sm">
          {(
            [
              ["both", "양쪽 다"],
              ["receiver", "공급받는자만"],
              ["supplier", "공급자만"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={`/sales/${id}/print?copies=${value}`}
              className={`rounded px-3 py-1.5 ${
                copies === value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <PrintButton />
      </div>
      <InvoicePage
        company={company}
        customerName={order.customers?.name ?? ""}
        orderDate={order.order_date}
        docNumber={docNumber}
        items={invoiceItems}
        memo={order.memo}
        copies={copies}
      />
    </div>
  );
}
