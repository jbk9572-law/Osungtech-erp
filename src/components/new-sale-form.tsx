"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createSale } from "@/app/(dashboard)/sales/actions";
import {
  getPaperCalculationsForPurchaseOrder,
  getPurchaseItemsForDate,
  type TodayPurchaseItem,
} from "@/app/(dashboard)/purchases/actions";
import type { PendingCalc } from "@/lib/paper-calc-sync";
import { ProductSearchSelect } from "@/components/product-search-select";
import { PartySearchSelect } from "@/components/party-search-select";
import { QuickAddProductSearch } from "@/components/quick-add-product-search";
import { FormMessage } from "@/components/form-message";
import type { FormState } from "@/components/form-message";
import { PriceHistoryHint } from "@/components/price-history-hint";
import { NumberInput } from "@/components/number-input";
import { QuantityWithBoxInput } from "@/components/quantity-with-box-input";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import {
  focusSameColumnNextRow,
  focusGridArrowNav,
} from "@/lib/grid-enter-nav";
import { PaperCalcModalTrigger } from "@/components/paper-calc/paper-calc-modal-trigger";
import type { PendingCalcPayload } from "@/components/paper-calc/paper-calc-client";
import { PENDING_PAPER_CALC_KEY } from "@/lib/paper-calc-pending-key";
import {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
  type PaperCalcSizeRow,
} from "@/lib/paper-calc-summary";
import {
  getOpenTodos,
  getPaperCalculationsForTodo,
  type OpenTodoSummary,
} from "@/app/(dashboard)/todos/actions";
import { todoTypeLabel } from "@/lib/todo-flow";
import { DELIVERY_METHODS } from "@/lib/delivery-method";
import { RETURN_REASONS } from "@/lib/return-reason";
import { nextMonthLabel } from "@/lib/carryover";

type Customer = { id: string; name: string; notes?: string | null };
type Product = {
  id: string;
  sku: string;
  name: string;
  spec?: string | null;
  unit?: string | null;
  price: number;
  stock?: number;
  base_package_qty?: number | null;
};
type CustomerPrice = {
  customer_id: string;
  product_id: string;
  unit_price: number;
};
type PriceHistoryEntry = {
  customerId: string;
  productId: string;
  unitPrice: number;
  orderDate: string;
  lotNumber?: string | null;
};

type Row = {
  key: number;
  productId: string;
  spec: string;
  manualSpec: boolean;
  lotNumber: string;
  quantity: number;
  unitPrice: number;
  manualPrice: boolean;
  remark: string;
};

const PAYMENT_METHODS = ["현금", "계좌이체", "카드", "어음"];

export type SaleInitial = {
  id: string;
  customerId: string;
  warehouseId: string;
  orderDate: string;
  memo: string;
  paymentMethod?: string | null;
  deliveryMethod?: string | null;
  docNo?: number | null;
  isReturn?: boolean;
  returnReason?: string | null;
  isCarryover?: boolean;
  items: {
    productId: string;
    spec?: string | null;
    quantity: number;
    unitPrice: number;
    remark?: string | null;
    lotNumber?: string | null;
  }[];
};

export function NewSaleForm({
  customers,
  products,
  warehouseId,
  prices,
  history,
  action = createSale,
  initial,
  submitLabel = "매출 등록",
  backParam,
  initialIsReturn = false,
}: {
  customers: Customer[];
  products: Product[];
  warehouseId: string;
  prices: CustomerPrice[];
  history: PriceHistoryEntry[];
  action?: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: SaleInitial;
  submitLabel?: string;
  // 목록에서 검색/필터를 걸어둔 채로 상세 → 수정으로 들어온 경우, 저장 후
  // 그 목록으로 돌아가기 위해 서버 액션(updateSale)에 그대로 넘긴다.
  backParam?: string;
  // 신규 등록 화면에서 매출/수금/반품 3버튼 중 "반품"으로 들어온 경우에만
  // 쓴다(NewSaleTypeSwitcher 참고) — 수정 화면은 initial.isReturn을 그대로 쓴다.
  initialIsReturn?: boolean;
}) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [orderDate, setOrderDate] = useState(
    // toISOString()은 UTC 기준이라, 자정~오전 9시(KST) 사이에는 오늘이 아니라
    // "어제" 날짜가 잡힌다. 로컬 날짜를 그대로 쓰는 toLocaleDateString("sv-SE")로
    // 통일한다(price-schedule.ts 등 다른 곳의 "오늘" 계산과 동일한 방식).
    () => initial?.orderDate ?? new Date().toLocaleDateString("sv-SE"),
  );
  const [memo, setMemo] = useState(initial?.memo ?? "");
  // "항상 외상"이 기본값(체크됨)이라 결제방법 없이 등록하면 미수금 잔액
  // 계산 대상에 그대로 잡힌다. 체크를 풀고 결제방법을 고르면 그 자리에서
  // 결제가 끝난 거래로 보고 미수금 계산에서 빠진다(lib/ar-ap.ts).
  const [alwaysCredit, setAlwaysCredit] = useState(!initial?.paymentMethod);
  const [paymentMethod, setPaymentMethod] = useState(
    initial?.paymentMethod ?? "",
  );
  // 대부분 직납이라 매번 고를 필요 없게 기본값으로 채워둔다 — 다른 방법이면
  // 그때만 직접 바꾸면 된다.
  const [deliveryMethod, setDeliveryMethod] = useState(
    initial?.deliveryMethod ?? "직납",
  );
  // 인쇄되는 거래명세표의 No와 값을 맞출 수 있게, 비워두면 자동 채번되는
  // 전표번호를 직접 입력/수정할 수 있게 한다.
  const [docNo, setDocNo] = useState(
    initial?.docNo ? String(initial.docNo) : "",
  );
  // 반품(잘못 납품해 되돌아온 건)으로 등록하면 이 매출과 똑같은 폼/품목
  // 구조를 그대로 쓰되, 서버 액션이 재고를 출고(out) 대신 입고(in)로
  // 반영하고, 매출 합계·미수금·리포트에서는 이 건의 금액을 차감 처리한다.
  const isReturn = initial?.isReturn ?? initialIsReturn;
  const [returnReason, setReturnReason] = useState(
    initial?.returnReason ?? RETURN_REASONS[0],
  );
  // 거래일자는 항상 실제 처리일 그대로 두고, "다음 달 실적으로 잡을지"만
  // 이 체크박스로 명시적으로 관리한다(예전에는 거래일자 자체를 미래 날짜로
  // 입력해서 이월을 표현했다 — 그 방식은 달력/명세표에 실제 날짜가 안
  // 보이는 문제가 있었다).
  const [isCarryover, setIsCarryover] = useState(
    initial?.isCarryover ?? false,
  );
  const [rows, setRows] = useState<Row[]>(
    initial?.items.length
      ? initial.items.map((item, i) => ({
          key: i,
          productId: item.productId,
          spec: item.spec ?? "",
          manualSpec: Boolean(item.spec),
          lotNumber: item.lotNumber ?? "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          manualPrice: false,
          remark: item.remark ?? "",
        }))
      : [
          {
            key: 0,
            productId: "",
            spec: "",
            manualSpec: false,
            lotNumber: "",
            quantity: 0,
            unitPrice: 0,
            manualPrice: false,
            remark: "",
          },
        ],
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [state, formAction, pending] = useActionState(action, undefined);
  // 등록 실패 메시지는 실제로 다시 제출하기 전까지는 useActionState가 값을
  // 갱신하지 않는다. 값을 수정한 뒤에도 이전 실패 메시지가 그대로 남아있으면
  // "고쳤는데도 계속 실패한다"고 오해하게 되므로, 입력을 건드리는 순간
  // 화면에서만 숨긴다 (다시 제출하면 onSubmit에서 원복해 새 결과를 보여줌).
  const [messageDismissed, setMessageDismissed] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  // 신규 등록일 때만 의미가 있다: 수정 화면은 이미 sales_order_id가 있어서
  // 모조지 계산 화면에서 바로 저장하면 되고, 여기서 또 붙일 필요가 없다.
  // 이 값을 채우는 경로는 두 가지다.
  // 1) 이 폼 안의 모달(PaperCalcModalTrigger)에서 "이 계산 적용하기"를
  //    누르면 onApply 콜백으로 바로 이 state에 꽂힌다.
  // 2) 트리메뉴/탭바를 통해 독립적으로 연 "확장모듈 > 모조지 계산"
  //    화면에서 미리 테스트 계산을 해보고 "새 판매 등록에 연결"을 누른
  //    경우 — 그 화면은 이 폼과 다른 페이지라 직접 콜백을 넘길 수 없어,
  //    localStorage에 잠깐 담아뒀다가 이 폼이 마운트될 때(혹은 이미 열려
  //    있는 다른 탭에서 나중에 저장했을 때 storage 이벤트로) 읽어온다.
  const [pendingPaperCalc, setPendingPaperCalc] = useState<string | null>(null);
  function handlePaperCalcApply(payload: PendingCalcPayload) {
    setPendingPaperCalc(JSON.stringify(payload));
  }

  useEffect(() => {
    if (initial?.id) return;
    setPendingPaperCalc(localStorage.getItem(PENDING_PAPER_CALC_KEY));

    function handleStorage(e: StorageEvent) {
      if (e.key === PENDING_PAPER_CALC_KEY) {
        setPendingPaperCalc(e.newValue);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [initial?.id]);

  // 당일 입고된 품목을 그대로 매출로 옮겨 담는 기능(모조지처럼 당일 입고 후
  // 바로 당일 출고되는 품목을 이중 입력하지 않게 하려는 용도). 거래일자와
  // 별도로 조회할 날짜를 고를 수 있게 한다 — 매출 등록일과 실제 입고일이
  // 다른 경우(예: 어제 입고분을 오늘 매출로 처리)도 있기 때문.
  const [purchaseLookupDate, setPurchaseLookupDate] = useState(orderDate);
  const [purchaseCandidates, setPurchaseCandidates] = useState<
    TodayPurchaseItem[] | null
  >(null);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [addedPurchaseItemIds, setAddedPurchaseItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  // 모조지(TG0) 입고 품목은 수량만 옮기면 사이즈별 배치 내역이 사라지므로,
  // 그 매입 건에 연결된 모조지 계산 자체를 통째로 복사해서 등록 시 같이 붙인다.
  const [copiedPaperCalcs, setCopiedPaperCalcs] = useState<PendingCalc[]>([]);

  async function loadPurchasesForDate() {
    setLoadingPurchases(true);
    setAddedPurchaseItemIds(new Set());
    try {
      const items = await getPurchaseItemsForDate(purchaseLookupDate);
      setPurchaseCandidates(items);
    } finally {
      setLoadingPurchases(false);
    }
  }

  async function addPurchaseItem(item: TodayPurchaseItem) {
    if (item.sku === "TG0") {
      setAddingItemId(item.id);
      try {
        const calcs = await getPaperCalculationsForPurchaseOrder(
          item.purchaseOrderId,
        );
        if (calcs.length > 0) {
          setCopiedPaperCalcs((prev) => [...prev, ...calcs]);
          setAddedPurchaseItemIds((prev) => new Set(prev).add(item.id));
          return;
        }
      } finally {
        setAddingItemId(null);
      }
    }

    const newRow: Row = {
      key: nextKey,
      productId: item.productId,
      spec: item.spec,
      manualSpec: Boolean(item.spec),
      lotNumber: item.lotNumber,
      quantity: item.quantity,
      unitPrice: resolvePrice(customerId, item.productId),
      manualPrice: false,
      remark: "",
    };
    setRows((prev) =>
      prev.length === 1 && !prev[0].productId && prev[0].quantity === 0
        ? [newRow]
        : [...prev, newRow],
    );
    setNextKey((k) => k + 1);
    setAddedPurchaseItemIds((prev) => new Set(prev).add(item.id));
  }

  // 우리 쪽 품목은 대부분 당일 입고 후 바로 당일 출고돼서, 출고 예정을
  // 잊지 않으려고 미리 적어둔 할일이 사실상 이번 매출 품목 목록과 같다.
  // 할일의 구조화된 items를 그대로 품목 행으로 옮겨 담는다 — 이미 productId
  // 기준으로 골라둔 데이터라 이름 매칭 같은 추측이 필요 없다. 할일에
  // 모조지 계산이 붙어있으면 그것도 통째로 복사해온다.
  const [openTodos, setOpenTodos] = useState<OpenTodoSummary[] | null>(null);
  const [loadingTodos, setLoadingTodos] = useState(false);
  const [importingTodoId, setImportingTodoId] = useState<string | null>(null);
  // 가져온 할일 id들 — 등록이 실제로 성공하면 서버 액션이 이 id들의 매출
  // 방향을 완료 처리한다(가져오기만 하고 등록을 안 하면 아무 일도 없음).
  const [importedTodoIds, setImportedTodoIds] = useState<string[]>([]);

  async function loadOpenTodos() {
    setLoadingTodos(true);
    try {
      setOpenTodos(await getOpenTodos("sale"));
    } finally {
      setLoadingTodos(false);
    }
  }

  async function importTodoItems(todo: OpenTodoSummary) {
    // 할일에 출고처를 골라뒀으면 그걸 그대로 확정하고, 없으면(예전 데이터)
    // 제목이 거래처명과 일치할 때만 추측으로 채운다. setState는 비동기라
    // 아래 단가 계산에 새 거래처가 바로 반영되도록 값을 따로 들고 간다.
    let effectiveCustomerId = customerId;
    if (!customerId) {
      const fromTodo =
        todo.customer_id && customers.some((c) => c.id === todo.customer_id)
          ? todo.customer_id
          : null;
      const matched =
        fromTodo ??
        customers.find(
          (c) =>
            c.name.trim().toLowerCase() === todo.title.trim().toLowerCase(),
        )?.id ??
        null;
      if (matched) {
        handleCustomerChange(matched);
        effectiveCustomerId = matched;
      }
    }

    if (todo.items.length > 0) {
      const newRows: Row[] = todo.items.map((item, i) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          key: nextKey + i,
          productId: item.productId,
          spec: item.spec ?? product?.spec ?? "",
          manualSpec: Boolean(item.spec),
          lotNumber: item.lotNumber ?? "",
          quantity: item.quantity,
          unitPrice: product
            ? resolvePrice(effectiveCustomerId, product.id)
            : 0,
          manualPrice: false,
          remark: "",
        };
      });

      setRows((prev) =>
        prev.length === 1 && !prev[0].productId && prev[0].quantity === 0
          ? newRows
          : [...prev, ...newRows],
      );
      setNextKey((k) => k + newRows.length);
    }

    setImportingTodoId(todo.id);
    try {
      const calcs = await getPaperCalculationsForTodo(todo.id);
      if (calcs.length > 0) {
        setCopiedPaperCalcs((prev) => [...prev, ...calcs]);
      }
    } finally {
      setImportingTodoId(null);
    }

    setImportedTodoIds((prev) =>
      prev.includes(todo.id) ? prev : [...prev, todo.id],
    );
    setOpenTodos(null);
  }

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const price of prices) {
      map.set(
        `${price.customer_id}:${price.product_id}`,
        Number(price.unit_price),
      );
    }
    return map;
  }, [prices]);

  // 수정 화면에서는 product.stock이 "이 거래로 이미 출고 처리된 뒤"의 현재
  // 재고라, 원래 수량 그대로 비교하면 항상 부족한 것처럼 보인다. 이 거래가
  // 원래 갖고 있던 수량만큼은 되돌려받은 셈 치고 비교해야 한다.
  const originalQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initial?.items ?? []) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [initial]);

  function resolvePrice(forCustomerId: string, productId: string) {
    const fromCustomer = priceMap.get(`${forCustomerId}:${productId}`);
    if (fromCustomer !== undefined) return fromCustomer;
    const product = products.find((p) => p.id === productId);
    return product ? Number(product.price) : 0;
  }

  // 케이아이티솔루션·제니스테크·타이거일렉처럼 같은 거래처+품목 조합에
  // 매번 같은 관리번호를 써온 경우, 지난번 값을 다시 찾아 입력할 필요
  // 없게 가장 최근 값을 그대로 이어서 채운다.
  function getRecentLotNumber(
    forCustomerId: string,
    productId: string,
  ): string | null {
    if (!forCustomerId) return null;
    const entries = history
      .filter(
        (h) =>
          h.customerId === forCustomerId &&
          h.productId === productId &&
          h.lotNumber,
      )
      .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));
    return entries[0]?.lotNumber ?? null;
  }

  // 임시 저장된 모조지 계산 + 입고 불러오기로 복사해온 계산들을 합쳐서,
  // 등록 버튼을 누르기 전에도 TG0 품목 줄이 실제로 어떤 수량으로 들어갈지
  // 그리드에 미리 보여준다. 이 줄은 편집 가능한 rows에는 넣지 않는다 —
  // 실제 저장은 createSale이 주문 생성 직후 attachPendingPaperCalculation/
  // attachCopiedPaperCalculations으로 처리하고(재고는 건드리지 않음), 여기서
  // rows에 섞으면 일반 품목과 똑같이 재고가 차감돼버린다.
  const pendingCalcSummary = useMemo(() => {
    let totalSheet = 0;
    let totalPaper = 0;
    if (pendingPaperCalc) {
      try {
        const parsed = JSON.parse(pendingPaperCalc) as {
          totalSheet: number;
          totalPaper: number;
        };
        totalSheet += parsed.totalSheet;
        totalPaper += parsed.totalPaper;
      } catch {
        // 무시: 잘못된 값이면 이 부분은 0으로 취급
      }
    }
    for (const calc of copiedPaperCalcs) {
      totalSheet += calc.totalSheet;
      totalPaper += calc.totalPaper;
    }
    return totalSheet > 0 ? { totalSheet, totalPaper } : null;
  }, [pendingPaperCalc, copiedPaperCalcs]);
  const tg0Product = useMemo(
    () => products.find((p) => p.sku === "TG0"),
    [products],
  );
  const pendingCalcUnitPrice = tg0Product
    ? resolvePrice(customerId, tg0Product.id)
    : 0;
  // 거래처와 협의해 자동 계산값(예: 3.2연)과 다른 수량(예: 3연)으로 등록해야
  // 하는 경우, 등록 시점에 바로 고칠 수 있게 한다 — null이면 자동값 그대로.
  // 저장 시(createSale)에는 이 값이 있을 때만 오버라이드 이력을 남긴다.
  const [tg0OverrideQuantity, setTg0OverrideQuantity] = useState<number | null>(
    null,
  );
  const pendingCalcQuantity = pendingCalcSummary
    ? (tg0OverrideQuantity ?? pendingCalcSummary.totalSheet)
    : 0;
  const pendingCalcAmount = pendingCalcQuantity * pendingCalcUnitPrice;
  const tg0IsOverridden =
    pendingCalcSummary !== null &&
    tg0OverrideQuantity !== null &&
    tg0OverrideQuantity !== pendingCalcSummary.totalSheet;

  // TG0(모조지) 한 줄은 연 단위 수량/금액만 보여주지만, 실제로 어떤
  // 사이즈를 몇 장씩 조합해서 그 연수가 나왔는지는 메모 한 줄에 다 담기
  // 어렵다 — 그래서 계산에 들어간 사이즈별 수량을 품목 표 아래에 참고용
  // 줄로 그대로 보여준다. 이 줄들은 수량/단가를 세지 않는다(원지
  // 자체는 연 단위로만 청구하고, 여기 사이즈들은 그 원지를 조합해서
  // 만드는 최종 상품일 뿐 별도로 판매/청구되는 게 아니기 때문).
  const paperCalcSizeLines = useMemo(() => {
    let sizes: PaperCalcSizeRow[] = [];
    if (pendingPaperCalc) {
      try {
        const parsed = JSON.parse(pendingPaperCalc) as { inputItems?: unknown };
        sizes = mergePaperCalcInputItems(sizes, parsed.inputItems);
      } catch {
        // 무시
      }
    }
    for (const calc of copiedPaperCalcs) {
      sizes = mergePaperCalcInputItems(sizes, calc.inputItems);
    }
    return formatPaperCalcSizeLines(sizes);
  }, [pendingPaperCalc, copiedPaperCalcs]);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function handleProductChange(key: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    const currentRow = rows.find((r) => r.key === key);
    const recentLotNumber = getRecentLotNumber(customerId, productId);
    updateRow(key, {
      productId,
      spec: product?.spec ?? "",
      unitPrice: resolvePrice(customerId, productId),
      ...(recentLotNumber && !currentRow?.lotNumber
        ? { lotNumber: recentLotNumber }
        : {}),
    });
  }

  function handleCustomerChange(newCustomerId: string) {
    setCustomerId(newCustomerId);
    setRows((prev) =>
      prev.map((row) => {
        if (!row.productId) return row;
        const recentLotNumber = getRecentLotNumber(
          newCustomerId,
          row.productId,
        );
        return {
          ...row,
          ...(row.manualPrice
            ? {}
            : { unitPrice: resolvePrice(newCustomerId, row.productId) }),
          ...(recentLotNumber && !row.lotNumber
            ? { lotNumber: recentLotNumber }
            : {}),
        };
      }),
    );
  }

  // 검색창에서 Enter로 바로 추가할 때 쓴다 — "+ 품목 추가"로 빈 줄을
  // 만들고 그 안에서 다시 검색하는 2단계 대신, 검색해서 고른 품목이
  // 바로 채워진 새 줄을 만든다(입고 불러오기의 addPurchaseItem과 동일한
  // 방식으로, 아직 아무것도 안 고른 첫 빈 줄이면 그 줄을 그대로 채운다).
  function quickAddProduct(productId: string) {
    const product = products.find((p) => p.id === productId);
    const newRow: Row = {
      key: nextKey,
      productId,
      spec: product?.spec ?? "",
      manualSpec: false,
      lotNumber: getRecentLotNumber(customerId, productId) ?? "",
      quantity: 0,
      unitPrice: resolvePrice(customerId, productId),
      manualPrice: false,
      remark: "",
    };
    setRows((prev) =>
      prev.length === 1 && !prev[0].productId && prev[0].quantity === 0
        ? [newRow]
        : [...prev, newRow],
    );
    setNextKey((k) => k + 1);
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: nextKey,
        productId: "",
        spec: "",
        manualSpec: false,
        lotNumber: "",
        quantity: 0,
        unitPrice: 0,
        manualPrice: false,
        remark: "",
      },
    ]);
    setNextKey((k) => k + 1);
  }

  // 맨 아래에만 추가되던 "+ 품목 추가"와 달리, 이미 입력해둔 줄들 사이에
  // 빠뜨린 품목을 끼워 넣고 싶을 때를 위한 것 — 그 줄 바로 아래에 빈 줄을
  // 삽입한다.
  function insertRowAfter(key: number) {
    setRows((prev) => {
      const idx = prev.findIndex((row) => row.key === key);
      if (idx === -1) return prev;
      const newRow: Row = {
        key: nextKey,
        productId: "",
        spec: "",
        manualSpec: false,
        lotNumber: "",
        quantity: 0,
        unitPrice: 0,
        manualPrice: false,
        remark: "",
      };
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((row) => row.key !== key) : prev,
    );
  }

  function getHistoryFor(productId: string) {
    return history
      .filter((h) => h.customerId === customerId && h.productId === productId)
      .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));
  }

  // 화면에 보여주는 합계가 실제 제출되는(itemsJson) 값과 항상 같도록,
  // 제출에서 제외되는 행(품목 미선택, 수량 0 이하)은 합계에서도 뺀다.
  const submittedRows = rows.filter((row) => row.productId && row.quantity > 0);
  const supplyAmount =
    submittedRows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0) +
    pendingCalcAmount;
  const taxAmount = Math.round(supplyAmount * 0.1);
  const total = supplyAmount + taxAmount;

  const itemsJson = JSON.stringify(
    submittedRows
      .map((row) => ({
        productId: row.productId,
        // 직접입력이 아니면 규격을 스냅샷으로 고정하지 않고 null로 저장해서,
        // 품목관리에서 마스터 규격을 나중에 고쳐도 계속 최신값을 따라가게 한다.
        spec: row.manualSpec ? row.spec : null,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        remark: row.remark || null,
        lotNumber: row.lotNumber || null,
      })),
  );

  return (
    <form
      action={formAction}
      className="space-y-6"
      onKeyDown={preventEnterSubmit}
      onChangeCapture={() => setMessageDismissed(true)}
      onClickCapture={() => setMessageDismissed(true)}
      onSubmit={() => {
        setMessageDismissed(false);
        // 제출 시점에 임시 계산을 같이 넘기고 나면 더 이상 필요 없으니
        // 지운다(모달 콜백으로 들어온 값은 애초에 localStorage에 쓴 적이
        // 없어 지울 것도 없다). 등록이 실패해도 계산 자체는 다시 하면
        // 되므로 감수할 만한 트레이드오프다.
        if (pendingPaperCalc) localStorage.removeItem(PENDING_PAPER_CALC_KEY);
      }}
    >
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      {backParam && <input type="hidden" name="back" value={backParam} />}
      <input type="hidden" name="doc_no" value={docNo} />
      <input type="hidden" name="warehouse_id" value={warehouseId} />
      <input
        type="hidden"
        name="payment_method"
        value={alwaysCredit ? "" : paymentMethod}
      />
      <input type="hidden" name="delivery_method" value={deliveryMethod} />
      <input type="hidden" name="is_return" value={isReturn ? "1" : ""} />
      {isReturn && <input type="hidden" name="return_reason" value={returnReason} />}
      <input type="hidden" name="is_carryover" value={isCarryover ? "1" : ""} />
      <input type="hidden" name="items" value={itemsJson} />
      {pendingPaperCalc && (
        <input type="hidden" name="pendingPaperCalc" value={pendingPaperCalc} />
      )}
      {copiedPaperCalcs.length > 0 && (
        <input
          type="hidden"
          name="copiedPaperCalcs"
          value={JSON.stringify(copiedPaperCalcs)}
        />
      )}
      {importedTodoIds.length > 0 && (
        <input
          type="hidden"
          name="importedTodoIds"
          value={JSON.stringify(importedTodoIds)}
        />
      )}
      {tg0IsOverridden && (
        <input
          type="hidden"
          name="tg0OverrideQuantity"
          value={tg0OverrideQuantity ?? ""}
        />
      )}

      {(pendingPaperCalc || copiedPaperCalcs.length > 0) && (
        <div
          className="rounded p-2 text-xs"
          style={{
            background: "var(--erp-info-bg)",
            color: "var(--erp-info-text)",
            border: "1px solid var(--erp-info-border)",
          }}
        >
          모조지 계산 결과가 이 주문에 연결되어 있습니다 — 아래 품목 목록에 TG0
          자동 반영 줄로 표시됩니다. 등록하면 실제로 저장됩니다.
        </div>
      )}

      {isReturn && (
        <div
          className="rounded p-2 text-xs"
          style={{
            marginBottom: 12,
            background: "var(--erp-danger-bg)",
            color: "var(--erp-danger)",
            border: "1px solid var(--erp-danger-border)",
          }}
        >
          <div style={{ marginBottom: 8 }}>
            반품으로 등록하면 이 품목 수량만큼 재고가 증가하고, 매출 합계·미수금에서는 차감됩니다.
          </div>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
            }}
          >
            반품 사유
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="erp-select"
              style={{ height: 26, fontSize: 12.5 }}
            >
              {RETURN_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {isCarryover && (
        <div
          className="rounded p-2 text-xs"
          style={{
            marginBottom: 12,
            background: "var(--erp-warning-bg)",
            color: "var(--erp-warning)",
            border: "1px solid var(--erp-warning-border)",
          }}
        >
          거래일자는 {orderDate} 그대로 저장되고, 월별 리포트·대시보드 집계에서만{" "}
          {nextMonthLabel(orderDate)} 실적으로 잡힙니다. 목록/달력에는 오늘 처리한 건으로
          그대로 표시됩니다.
        </div>
      )}

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div
          className="erp-detail-tabs"
          style={{ justifyContent: "space-between" }}
        >
          <span className="erp-detail-tab active">기본정보</span>
          <button
            ref={submitRef}
            type="submit"
            disabled={pending}
            className="erp-btn erp-btn-primary"
            style={{ minWidth: 0, margin: 4 }}
          >
            {pending ? (
              <>
                <span className="erp-spinner" aria-hidden /> 저장 중...
              </>
            ) : (
              `F7 ${isReturn ? `반품 ${initial?.id ? "수정" : "등록"}` : submitLabel}`
            )}
          </button>
        </div>
        {!!(messageDismissed ? undefined : state) && (
          <div style={{ padding: "8px 14px 0" }}>
            <FormMessage state={messageDismissed ? undefined : state} />
          </div>
        )}
        <div
          className="erp-detail-body erp-search"
          style={{ border: "none", padding: 14, margin: 0 }}
        >
          <div className="erp-field">
            <label htmlFor="sale-docno">No</label>
            <input
              id="sale-docno"
              type="text"
              inputMode="numeric"
              placeholder="자동"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value.replace(/[^0-9]/g, ""))}
              className="erp-input"
              style={{ width: 80 }}
              title="비워두면 자동으로 채번됩니다. 인쇄되는 거래명세표의 No와 같은 번호입니다."
            />
          </div>
          <div className="erp-field">
            <label htmlFor="sale-customer">출고처</label>
            <PartySearchSelect
              id="sale-customer"
              name="customer_id"
              parties={customers}
              value={customerId}
              onChange={handleCustomerChange}
              placeholder="출고처명 검색"
            />
          </div>
          <div className="erp-field">
            <label htmlFor="sale-order-date">거래일자</label>
            <input
              id="sale-order-date"
              name="order_date"
              type="date"
              required
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="erp-input"
            />
          </div>
          <div className="erp-field">
            <label aria-hidden="true">&nbsp;</label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 34,
                padding: "0 14px",
                borderRadius: 6,
                background: isCarryover ? "var(--erp-warning-bg)" : "transparent",
                border: `1px solid ${isCarryover ? "var(--erp-warning-border)" : "var(--erp-border)"}`,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={isCarryover}
                onChange={(e) => setIsCarryover(e.target.checked)}
              />
              <span
                style={{
                  fontWeight: 700,
                  color: isCarryover ? "var(--erp-warning)" : "var(--erp-text-muted)",
                }}
              >
                {nextMonthLabel(orderDate)} 실적으로 이월
              </span>
            </label>
          </div>
          <div className="erp-field">
            <label htmlFor="sale-delivery-method">배송방법</label>
            <select
              id="sale-delivery-method"
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value)}
              className="erp-select"
            >
              <option value="">-</option>
              {DELIVERY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="erp-field" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="sale-memo">적요 (선택)</label>
            <input
              id="sale-memo"
              name="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="erp-input"
              style={{ width: "100%" }}
            />
          </div>
          <div className="erp-field">
            <label>결제방법</label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 30,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={alwaysCredit}
                onChange={(e) => setAlwaysCredit(e.target.checked)}
              />
              항상 외상
            </label>
          </div>
          {!alwaysCredit && (
            <div className="erp-field">
              <label aria-hidden="true">&nbsp;</label>
              <select
                aria-label="결제방법"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="erp-select"
                required
              >
                <option value="" disabled>
                  결제방법 선택
                </option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div
          className="erp-detail-tabs"
          style={{ justifyContent: "space-between", position: "relative" }}
        >
          <span className="erp-detail-tab active">품목</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              margin: 4,
              flexWrap: "wrap",
            }}
          >
            <QuickAddProductSearch
              products={products}
              onAdd={quickAddProduct}
            />
            <input
              type="date"
              value={purchaseLookupDate}
              onChange={(e) => setPurchaseLookupDate(e.target.value)}
              className="erp-input"
              style={{ width: 130 }}
            />
            <button
              type="button"
              onClick={() => {
                setOpenTodos(null);
                loadPurchasesForDate();
              }}
              className="erp-btn"
              style={{ minWidth: 0 }}
              disabled={loadingPurchases}
            >
              {loadingPurchases ? "불러오는 중..." : "입고 불러오기"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPurchaseCandidates(null);
                loadOpenTodos();
              }}
              className="erp-btn"
              style={{ minWidth: 0 }}
              disabled={loadingTodos}
            >
              {loadingTodos ? "불러오는 중..." : "할일 가져오기"}
            </button>
            <button
              type="button"
              onClick={addRow}
              className="erp-btn"
              style={{ minWidth: 0 }}
            >
              + 품목 추가
            </button>
            {!initial?.id && (
              <PaperCalcModalTrigger
                pendingFor="sales"
                onApply={handlePaperCalcApply}
              />
            )}
          </div>

          {purchaseCandidates !== null && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 4,
                zIndex: 20,
                width: 420,
                maxWidth: "90vw",
                maxHeight: 320,
                overflowY: "auto",
                background: "var(--erp-panel)",
                border: "1px solid var(--erp-border)",
                borderRadius: 2,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderBottom: "1px solid var(--erp-border)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>{purchaseLookupDate} 입고 품목</span>
                <button
                  type="button"
                  onClick={() => setPurchaseCandidates(null)}
                  className="erp-btn erp-btn-danger"
                  style={{ minWidth: 0, height: 22, padding: "0 8px" }}
                >
                  닫기
                </button>
              </div>
              {purchaseCandidates.length === 0 ? (
                <p className="erp-home-empty" style={{ padding: 10 }}>
                  해당 날짜에 입고된 품목이 없습니다.
                </p>
              ) : (
                purchaseCandidates.map((item) => {
                  const added = addedPurchaseItemIds.has(item.id);
                  const isAdding = addingItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "6px 10px",
                        borderBottom: "1px solid var(--erp-divider)",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>
                          {item.productName}
                        </div>
                        <div
                          style={{
                            color: "var(--erp-text-muted)",
                            fontSize: 11,
                          }}
                        >
                          {item.supplierName} · {item.spec || "규격 미지정"} :{" "}
                          {item.quantity.toLocaleString()}
                          {item.unit}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addPurchaseItem(item)}
                        className="erp-btn"
                        style={{
                          minWidth: 0,
                          height: 24,
                          padding: "0 8px",
                          flexShrink: 0,
                        }}
                        disabled={added || isAdding}
                      >
                        {added ? "추가됨" : isAdding ? "추가 중..." : "추가"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {openTodos !== null && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 4,
                zIndex: 20,
                width: 420,
                maxWidth: "90vw",
                maxHeight: 320,
                overflowY: "auto",
                background: "var(--erp-panel)",
                border: "1px solid var(--erp-border)",
                borderRadius: 2,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderBottom: "1px solid var(--erp-border)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>완료 안 한 할 일</span>
                <button
                  type="button"
                  onClick={() => setOpenTodos(null)}
                  className="erp-btn erp-btn-danger"
                  style={{ minWidth: 0, height: 22, padding: "0 8px" }}
                >
                  닫기
                </button>
              </div>
              {openTodos.length === 0 ? (
                <p className="erp-home-empty" style={{ padding: 10 }}>
                  완료 안 한 할 일이 없습니다.
                </p>
              ) : (
                openTodos.map((todo) => {
                  const itemCount = todo.items.length;
                  const isImporting = importingTodoId === todo.id;
                  return (
                    <div
                      key={todo.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "6px 10px",
                        borderBottom: "1px solid var(--erp-divider)",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>
                          {todo.title}
                          <span
                            className="erp-badge erp-badge-muted"
                            style={{ marginLeft: 6 }}
                          >
                            {todoTypeLabel(
                              todo.todo_type,
                              todo.ship_date,
                              todo.due_date,
                            )}
                          </span>
                          {todo.todo_type === "both" && (
                            <span
                              className={`erp-badge ${todo.purchase_done_at ? "erp-badge-success" : "erp-badge-warning"}`}
                              style={{ marginLeft: 4 }}
                            >
                              {todo.purchase_done_at ? "매입완료" : "매입 전"}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            color: "var(--erp-text-muted)",
                            fontSize: 11,
                          }}
                        >
                          {todo.customer_name ? `${todo.customer_name} · ` : ""}
                          {todo.due_date
                            ? `마감 ${todo.due_date} · `
                            : ""}품목 {itemCount}건
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => importTodoItems(todo)}
                        className="erp-btn"
                        style={{
                          minWidth: 0,
                          height: 24,
                          padding: "0 8px",
                          flexShrink: 0,
                        }}
                        disabled={isImporting}
                      >
                        {isImporting ? "가져오는 중..." : "가져오기"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div
          className="erp-grid-wrap"
          style={{ border: "none", borderRadius: 0, minHeight: "50vh" }}
        >
          <table
            className="erp-grid"
            style={{ tableLayout: "fixed", width: "100%", minWidth: 960 }}
          >
            <thead>
              <tr>
                <th style={{ width: "13%" }}>품목</th>
                <th style={{ width: "6%" }}>규격</th>
                <th style={{ width: "8%" }}>관리번호</th>
                <th style={{ width: "4%" }}>단위</th>
                <th className="num" style={{ width: "15%" }}>
                  수량
                </th>
                <th className="num" style={{ width: "9%" }}>
                  단가
                </th>
                <th className="num" style={{ width: "10%" }}>
                  공급가액
                </th>
                <th className="num" style={{ width: "8%" }}>
                  세액
                </th>
                <th className="num" style={{ width: "9%" }}>
                  합계
                </th>
                <th style={{ width: "13%" }}>비고</th>
                <th style={{ width: "5%" }} />
              </tr>
            </thead>
            <tbody
              onKeyDown={(e) => {
                focusSameColumnNextRow(e);
                focusGridArrowNav(e);
              }}
            >
              {pendingCalcSummary && (
                <tr style={{ background: "var(--erp-info-bg)" }}>
                  <td>
                    {tg0Product ? (
                      <>
                        {tg0Product.name}
                        <span
                          className="ml-1 rounded px-1 text-[10.5px]"
                          style={{
                            background: "var(--erp-info-border)",
                            color: "var(--erp-info-text)",
                          }}
                        >
                          자동
                        </span>
                      </>
                    ) : (
                      <span style={{ color: "var(--erp-danger)" }}>
                        SKU &apos;TG0&apos; 품목이 없어 자동 반영되지 않습니다
                      </span>
                    )}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {tg0Product?.unit ?? "-"}
                  </td>
                  <td className="num">
                    <NumberInput
                      value={pendingCalcQuantity}
                      onChange={setTg0OverrideQuantity}
                      className="erp-input w-full"
                    />
                  </td>
                  <td className="num">
                    {pendingCalcUnitPrice.toLocaleString()}
                  </td>
                  <td className="num">
                    {pendingCalcAmount.toLocaleString()}원
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    {Math.round(pendingCalcAmount * 0.1).toLocaleString()}원
                  </td>
                  <td className="num">
                    {(
                      pendingCalcAmount + Math.round(pendingCalcAmount * 0.1)
                    ).toLocaleString()}
                    원
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {tg0IsOverridden
                      ? `자동값 ${pendingCalcSummary.totalSheet.toLocaleString()} → 수동 입력`
                      : "모조지 계산 자동 반영"}
                  </td>
                  <td className="num">
                    <button
                      type="button"
                      className="erp-btn erp-btn-danger"
                      style={{ minWidth: 0, height: 26, padding: "0 8px" }}
                      onClick={() => {
                        localStorage.removeItem(PENDING_PAPER_CALC_KEY);
                        setPendingPaperCalc(null);
                        setCopiedPaperCalcs([]);
                        setTg0OverrideQuantity(null);
                      }}
                    >
                      취소
                    </button>
                  </td>
                </tr>
              )}
              {paperCalcSizeLines.map((line, i) => (
                <tr
                  key={`paper-calc-size-${i}`}
                  style={{ background: "var(--erp-bg-subtle)" }}
                >
                  <td
                    colSpan={3}
                    style={{ color: "var(--erp-text-muted)", paddingLeft: 24 }}
                  >
                    ㄴ {line}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    -
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    -
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    -
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    -
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    -
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>-</td>
                  <td />
                </tr>
              ))}
              {rows.map((row) => {
                const product = products.find((p) => p.id === row.productId);
                const recentPrice = row.productId
                  ? resolvePrice(customerId, row.productId)
                  : 0;
                return (
                  <tr key={row.key}>
                    <td>
                      <ProductSearchSelect
                        products={products}
                        value={row.productId}
                        onChange={(productId) =>
                          handleProductChange(row.key, productId)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="규격"
                        aria-label="규격"
                        value={row.spec}
                        onChange={(e) =>
                          updateRow(row.key, { spec: e.target.value })
                        }
                        disabled={!row.manualSpec}
                        className="erp-input w-full disabled:bg-[var(--erp-bg-disabled)] disabled:text-[var(--erp-text-muted)]"
                      />
                      {row.productId && (
                        <label
                          className="mt-1 flex items-center gap-1 text-[10.5px]"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          <input
                            type="checkbox"
                            checked={row.manualSpec}
                            onChange={(e) => {
                              const manualSpec = e.target.checked;
                              updateRow(row.key, {
                                manualSpec,
                                ...(manualSpec
                                  ? {}
                                  : { spec: product?.spec ?? "" }),
                              });
                            }}
                          />
                          직접입력
                        </label>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="관리번호"
                        aria-label="관리번호"
                        value={row.lotNumber}
                        onChange={(e) =>
                          updateRow(row.key, { lotNumber: e.target.value })
                        }
                        className="erp-input w-full"
                      />
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>
                      {product?.unit ?? "-"}
                    </td>
                    <td className="num">
                      <QuantityWithBoxInput
                        quantity={row.quantity}
                        onQuantityChange={(n) =>
                          updateRow(row.key, { quantity: n })
                        }
                        allowFormula
                      />
                    </td>
                    <td className="num">
                      <NumberInput
                        placeholder="단가"
                        value={row.unitPrice}
                        onChange={(n) => updateRow(row.key, { unitPrice: n })}
                        disabled={!row.manualPrice}
                        className="erp-input w-full disabled:bg-[var(--erp-bg-disabled)] disabled:text-[var(--erp-text-muted)]"
                      />
                      {row.productId && customerId && (
                        <label
                          className="mt-1 flex items-center justify-end gap-1 text-[10.5px]"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          <input
                            type="checkbox"
                            checked={row.manualPrice}
                            onChange={(e) => {
                              const manualPrice = e.target.checked;
                              updateRow(row.key, {
                                manualPrice,
                                ...(manualPrice
                                  ? {}
                                  : { unitPrice: recentPrice }),
                              });
                            }}
                          />
                          직접입력
                        </label>
                      )}
                    </td>
                    <td className="num">
                      {(row.quantity * row.unitPrice).toLocaleString()}원
                      {row.productId &&
                        product &&
                        (() => {
                          const availableStock =
                            (product.stock ?? 0) +
                            (originalQtyByProduct.get(row.productId) ?? 0);
                          const unit = product.unit ?? "";
                          // 반품은 출고가 아니라 입고(재고 증가)이므로 부족
                          // 여부를 따질 필요가 없다 — 늘어난 뒤 수량만 보여준다.
                          if (isReturn) {
                            const afterReturn = availableStock + row.quantity;
                            return (
                              <p
                                className="text-[10.5px]"
                                style={{ color: "var(--erp-danger)" }}
                              >
                                재고 {availableStock.toLocaleString()}
                                {unit} + 반품 {row.quantity.toLocaleString()}
                                {unit} = {afterReturn.toLocaleString()}
                                {unit}
                              </p>
                            );
                          }
                          // "재고 900"만 보여주면 이 출고를 반영하기 전인지 후인지
                          // 헷갈린다는 지적이 있어, 계산식 그대로 보여준다 —
                          // 재고에서 이번 출고량을 뺀 잔여 수량이 마이너스면
                          // 그 자체로 초과분을 뜻하므로 빨간색으로 강조한다.
                          const remaining = availableStock - row.quantity;
                          const short = remaining < 0;
                          return (
                            <p
                              className="text-[10.5px]"
                              style={{
                                color: short
                                  ? "var(--erp-danger)"
                                  : "var(--erp-primary)",
                              }}
                            >
                              재고 {availableStock.toLocaleString()}
                              {unit} - 출고 {row.quantity.toLocaleString()}
                              {unit} = {remaining.toLocaleString()}
                              {unit}
                              {short && " (부족)"}
                            </p>
                          );
                        })()}
                    </td>
                    <td
                      className="num"
                      style={{ color: "var(--erp-text-muted)" }}
                    >
                      {Math.round(
                        row.quantity * row.unitPrice * 0.1,
                      ).toLocaleString()}
                      원
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {(
                        row.quantity * row.unitPrice +
                        Math.round(row.quantity * row.unitPrice * 0.1)
                      ).toLocaleString()}
                      원
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="비고"
                        aria-label="비고"
                        value={row.remark}
                        onChange={(e) =>
                          updateRow(row.key, { remark: e.target.value })
                        }
                        className="erp-input w-full"
                      />
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="erp-btn"
                        style={{
                          minWidth: 0,
                          height: 26,
                          padding: "0 8px",
                          marginRight: 4,
                        }}
                        onClick={() => insertRowAfter(row.key)}
                        title="이 줄 아래에 빈 줄 삽입"
                      >
                        + 삽입
                      </button>
                      <button
                        type="button"
                        className="erp-btn erp-btn-danger"
                        style={{ minWidth: 0, height: 26, padding: "0 8px" }}
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length <= 1}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--erp-bg)" }}>
                <td colSpan={6} style={{ fontWeight: 700 }}>
                  합계
                </td>
                <td className="num" colSpan={5}>
                  <div style={{ color: "var(--erp-text-muted)" }}>
                    공급가액 {supplyAmount.toLocaleString()}원 · 부가세{" "}
                    {taxAmount.toLocaleString()}원
                  </div>
                  <div
                    className="text-sm font-bold"
                    style={{ color: "var(--erp-text)" }}
                  >
                    {total.toLocaleString()}원
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {rows.some(
          (r) =>
            r.productId && customerId && getHistoryFor(r.productId).length > 0,
        ) && (
          <div className="erp-detail-body" style={{ paddingTop: 8 }}>
            {rows
              .filter((r) => r.productId && customerId)
              .map((r) => {
                const hist = getHistoryFor(r.productId);
                if (!hist.length) return null;
                const product = products.find((p) => p.id === r.productId);
                return (
                  <div
                    key={r.key}
                    className="mb-1 flex items-center gap-2 text-xs"
                  >
                    <span style={{ color: "var(--erp-text-muted)" }}>
                      {product?.name}
                      {product?.spec && ` (${product.spec})`}:
                    </span>
                    <PriceHistoryHint history={hist} />
                    {hist[0]?.lotNumber && (
                      <span style={{ color: "var(--erp-text-muted)" }}>
                        · 최근 관리번호 {hist[0].lotNumber}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </form>
  );
}
