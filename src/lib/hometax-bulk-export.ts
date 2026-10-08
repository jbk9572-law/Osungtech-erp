// 국세청 홈택스 "전자(세금)계산서 발급 > 일괄발급(100건 이하)" 엑셀 업로드
// 양식 — 사용자가 실제로 홈택스에서 받은 공식 양식 파일(gongform.com류
// 종이계산서 템플릿이 아니라 국세청이 직접 저장한 파일, 시트 "엑셀업로드양식"/
// "항목설명"/"올바른 예시"/"잘못된 예시")을 열어서 확인한 59개 열 구성을
// 그대로 따른다.
//
// 핵심 제약(양식 안내문 원문): "임의로 양식을 변경[행 또는 열 추가 삭제 등]
// 하는 경우 발급시 오류가 발생할 수 있으므로, 정해진 양식으로 작성하시기
// 바랍니다" — 국세청 서버가 헤더 이름이 아니라 열 "위치"로 읽기 때문에,
// 열을 추가/삭제하면 그 뒤 열(현금/수표/어음/외상미수금/영수·청구)까지
// 전부 밀려서 잘못 읽힌다. 그래서 품목은 반드시 4개까지만 담을 수 있고,
// 그 이상이면 요약(상위 3개 + "외 N건" 합산)하거나 이 양식 대상에서
// 제외해야 한다 — 국세청 서버 쪽 규칙이라 우리 쪽에서 칸을 늘려 해결할
// 수 없다.
export const HOMETAX_BULK_EXCEL_HEADERS = [
  '전자(세금)계산서 종류\n(01:일반, 02:영세율)',
  '작성일자',
  '공급자 등록번호\n("-" 없이 입력)',
  '공급자\n 종사업장번호',
  '공급자 상호',
  '공급자 성명',
  '공급자 사업장주소',
  '공급자 업태',
  '공급자 종목',
  '공급자 이메일',
  '공급받는자 등록번호\n("-" 없이 입력)',
  '공급받는자 \n종사업장번호',
  '공급받는자 상호 ',
  '공급받는자 성명',
  '공급받는자 사업장주소',
  '공급받는자 업태',
  '공급받는자 종목',
  '공급받는자 이메일1',
  '공급받는자 이메일2',
  '공급가액\n합계',
  '세액\n합계',
  '비고',
  ...[1, 2, 3, 4].flatMap((n) => [
    `일자${n}\n(2자리, 작성년월 제외)`,
    `품목${n}`,
    `규격${n}`,
    `수량${n}`,
    `단가${n}`,
    `공급가액${n}`,
    `세액${n}`,
    `품목비고${n}`,
  ]),
  '현금',
  '수표',
  '어음',
  '외상미수금',
  '영수(01),\n청구(02)',
] as const;

const MAX_ITEM_SLOTS = 4;

export type BulkExportItem = {
  line_date: string | null;
  item_name: string;
  spec: string | null;
  quantity: number | null;
  unit_price: number | null;
  supply_amount: number;
  tax_amount: number;
  remark: string | null;
  sort_order: number;
};

export type BulkExportInvoice = {
  salesOrderId: string;
  invoiceType: "general" | "zero_rate";
  issueDate: string; // YYYY-MM-DD
  supplyAmount: number;
  taxAmount: number;
  cashAmount: number;
  checkAmount: number;
  noteAmount: number;
  creditAmount: number;
  claimType: "claim" | "receipt";
  remark: string | null;
  customerName: string;
  customerBusinessNumber: string | null;
  customerRepresentativeName: string | null;
  customerAddress: string | null;
  customerBusinessType: string | null;
  customerBusinessItem: string | null;
  customerEmail: string | null;
  items: BulkExportItem[];
};

export type SupplierInfo = {
  businessNumber: string | null;
  name: string | null;
  representativeName: string | null;
  address: string | null;
  businessType: string | null;
  businessItem: string | null;
  email: string | null;
};

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/[^0-9]/g, "");
}

function yyyymmdd(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

// 품목 줄의 "일자N"은 작성년월을 뺀 일(日) 2자리만 받는다 — 품목 날짜가
// 작성일자와 다른 달이면 그 양식으로는 표현할 길이 없어, 안전하게
// 작성일자의 일자로 대체한다(틀린 달을 담는 것보다 작성일자에 맞추는
// 편이 업로드 실패 위험이 적다).
function itemDay(itemDate: string | null, issueDate: string): string {
  if (itemDate && itemDate.slice(0, 7) === issueDate.slice(0, 7)) {
    return itemDate.slice(8, 10);
  }
  return issueDate.slice(8, 10);
}

type ItemSlotValues = {
  day: string;
  name: string;
  spec: string;
  quantity: number | string;
  unitPrice: number | string;
  supplyAmount: number | string;
  taxAmount: number | string;
  remark: string;
};

const BLANK_SLOT: ItemSlotValues = { day: "", name: "", spec: "", quantity: "", unitPrice: "", supplyAmount: "", taxAmount: "", remark: "" };

function toSlot(item: BulkExportItem, issueDate: string): ItemSlotValues {
  return {
    day: itemDay(item.line_date, issueDate),
    name: item.item_name,
    spec: item.spec ?? "",
    quantity: item.quantity ?? "",
    unitPrice: item.unit_price ?? "",
    supplyAmount: item.supply_amount,
    taxAmount: item.tax_amount,
    remark: item.remark ?? "",
  };
}

// 품목이 4개를 넘으면 상위 3개(sort_order 순서)는 그대로 두고, 나머지는
// 금액만 합쳐서 4번째 줄에 "외 N건"으로 넣는다 — 합계(공급가액/세액)는
// 항상 전체 품목 합과 똑같이 맞아떨어진다. 품목별 상세 내역 자체는
// 거래명세표(/sales/[id]/print)에 이미 전부 남아있어서, 세금계산서
// 쪽만 요약해도 정보가 사라지지 않는다.
function buildItemSlots(items: BulkExportItem[], issueDate: string, summarize: boolean): ItemSlotValues[] | null {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  if (sorted.length <= MAX_ITEM_SLOTS) {
    const slots = sorted.map((item) => toSlot(item, issueDate));
    while (slots.length < MAX_ITEM_SLOTS) slots.push(BLANK_SLOT);
    return slots;
  }
  if (!summarize) return null;

  const kept = sorted.slice(0, MAX_ITEM_SLOTS - 1).map((item) => toSlot(item, issueDate));
  const rest = sorted.slice(MAX_ITEM_SLOTS - 1);
  const restSupply = rest.reduce((sum, item) => sum + item.supply_amount, 0);
  const restTax = rest.reduce((sum, item) => sum + item.tax_amount, 0);
  const combined: ItemSlotValues = {
    day: issueDate.slice(8, 10),
    name: `외 ${rest.length}건`,
    spec: "",
    quantity: "",
    unitPrice: "",
    supplyAmount: restSupply,
    taxAmount: restTax,
    remark: "",
  };
  return [...kept, combined];
}

type AnySupabase = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

// 일괄발급 대상(일반/영세율, 원본만 — 위수탁/위수탁영세와 수정세금계산서는
// 이 양식 자체에 칸이 없어서 애초에 조회 대상에서 뺀다)과, 양식에 없는
// 종류라 건별입력이 필요한 건을 구분해서 둘 다 돌려준다.
export async function fetchHometaxBulkExportData(
  supabase: AnySupabase,
  from: string,
  to: string,
): Promise<{
  supplier: SupplierInfo;
  eligible: BulkExportInvoice[];
  ineligibleByType: { salesOrderId: string; customerName: string; issueDate: string; invoiceType: string }[];
}> {
  const [{ data: company }, { data: invoices }] = await Promise.all([
    supabase
      .from("company_profile")
      .select("business_number, name, representative_name, address, business_type, business_item, email")
      .maybeSingle(),
    supabase
      .from("tax_invoices")
      .select(
        "sales_order_id, invoice_type, issue_date, supply_amount, tax_amount, cash_amount, check_amount, note_amount, credit_amount, claim_type, remark, customers(name, business_number, representative_name, address, business_type, business_item, email), tax_invoice_items(line_date, item_name, spec, quantity, unit_price, supply_amount, tax_amount, remark, sort_order)",
      )
      .is("original_invoice_id", null)
      .gte("issue_date", from)
      .lte("issue_date", to)
      .order("issue_date"),
  ]);

  const supplier: SupplierInfo = {
    businessNumber: company?.business_number ?? null,
    name: company?.name ?? null,
    representativeName: company?.representative_name ?? null,
    address: company?.address ?? null,
    businessType: company?.business_type ?? null,
    businessItem: company?.business_item ?? null,
    email: company?.email ?? null,
  };

  const eligible: BulkExportInvoice[] = [];
  const ineligibleByType: { salesOrderId: string; customerName: string; issueDate: string; invoiceType: string }[] = [];

  for (const inv of invoices ?? []) {
    if (inv.invoice_type !== "general" && inv.invoice_type !== "zero_rate") {
      ineligibleByType.push({
        salesOrderId: inv.sales_order_id,
        customerName: inv.customers?.name ?? "",
        issueDate: inv.issue_date,
        invoiceType: inv.invoice_type,
      });
      continue;
    }
    eligible.push({
      salesOrderId: inv.sales_order_id,
      invoiceType: inv.invoice_type,
      issueDate: inv.issue_date,
      supplyAmount: inv.supply_amount,
      taxAmount: inv.tax_amount,
      cashAmount: inv.cash_amount,
      checkAmount: inv.check_amount,
      noteAmount: inv.note_amount,
      creditAmount: inv.credit_amount,
      claimType: inv.claim_type,
      remark: inv.remark,
      customerName: inv.customers?.name ?? "",
      customerBusinessNumber: inv.customers?.business_number ?? null,
      customerRepresentativeName: inv.customers?.representative_name ?? null,
      customerAddress: inv.customers?.address ?? null,
      customerBusinessType: inv.customers?.business_type ?? null,
      customerBusinessItem: inv.customers?.business_item ?? null,
      customerEmail: inv.customers?.email ?? null,
      items: inv.tax_invoice_items ?? [],
    });
  }

  return { supplier, eligible, ineligibleByType };
}

export function classifyAndBuildRows(
  invoices: BulkExportInvoice[],
  supplier: SupplierInfo,
  summarize: boolean,
): { rows: Record<string, unknown>[]; excluded: BulkExportInvoice[] } {
  const rows: Record<string, unknown>[] = [];
  const excluded: BulkExportInvoice[] = [];

  for (const invoice of invoices) {
    const slots = buildItemSlots(invoice.items, invoice.issueDate, summarize);
    if (!slots) {
      excluded.push(invoice);
      continue;
    }

    const values: unknown[] = [
      invoice.invoiceType === "zero_rate" ? "02" : "01",
      yyyymmdd(invoice.issueDate),
      digitsOnly(supplier.businessNumber),
      "",
      supplier.name ?? "",
      supplier.representativeName ?? "",
      supplier.address ?? "",
      supplier.businessType ?? "",
      supplier.businessItem ?? "",
      supplier.email ?? "",
      digitsOnly(invoice.customerBusinessNumber),
      "",
      invoice.customerName,
      invoice.customerRepresentativeName ?? "",
      invoice.customerAddress ?? "",
      invoice.customerBusinessType ?? "",
      invoice.customerBusinessItem ?? "",
      invoice.customerEmail ?? "",
      "",
      invoice.supplyAmount,
      invoice.taxAmount,
      invoice.remark ?? "",
    ];
    for (const slot of slots) {
      values.push(slot.day, slot.name, slot.spec, slot.quantity, slot.unitPrice, slot.supplyAmount, slot.taxAmount, slot.remark);
    }
    values.push(invoice.cashAmount, invoice.checkAmount, invoice.noteAmount, invoice.creditAmount, invoice.claimType === "receipt" ? "01" : "02");

    const row: Record<string, unknown> = {};
    HOMETAX_BULK_EXCEL_HEADERS.forEach((header, i) => {
      row[header] = values[i];
    });
    rows.push(row);
  }

  return { rows, excluded };
}
