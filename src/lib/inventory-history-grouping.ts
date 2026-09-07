// 매입/매출 전표를 수정하면 재고이력에 "되돌림(adjustment, 기존 효과 취소)"과
// "재반영(새 값)" 줄이 추가로 남는다(원장은 append-only라 지우지 않음).
// 그래서 전표 하나를 고쳤을 뿐인데 화면엔 원래 등록분 + 되돌림 + 재반영,
// 최소 3줄이 보이고, 그 사이에 무관한 다른 거래가 끼어있으면 무슨 일이
// 있었는지 눈으로 계산해야 했다.
//
// 이 파일은 그 여러 줄을 "같은 전표"인지 정확하게(추측 없이) 판별해서
// 하나로 합치는 순수 로직만 담는다. 판별 기준은 딱 하나 — reference
// 칼럼에 이미 박혀있는 전표 ID 문자열이 완전히 같은가 뿐이다. 거래처·
// 품목·날짜가 같다는 이유로 묶지 않는다(무관한 두 전표가 우연히 조건이
// 겹쳐 잘못 묶이는 걸 막기 위함 — 매입/매출을 서로 잇는 건 이 로직의
// 대상이 아니다. sales_order류는 sales_order류끼리, purchase_order류는
// purchase_order류끼리만 묶는다).

export type InventoryHistoryRow = {
  id: string;
  date: string;
  type: string;
  signedQty: number;
  partnerName: string | null;
  note: string | null;
  reference: string | null;
  href: string | null;
  balance: number;
  authorName: string | null;
  lotNumber: string | null;
};

export type GroupedInventoryHistoryRow = InventoryHistoryRow & {
  correctionNote: string | null;
};

const REFERENCE_ORDER_RE = /^(sales_order|purchase_order)(_reversal)?:(.+)$/;

// "sales_order:abc"와 "sales_order_reversal:abc"가 같은 그룹 키를
// 갖도록 "_reversal" 꼬리표만 떼어낸다. 매칭 안 되는 reference(재고실사,
// 수기조정, 모조지 자동반영 등)는 묶지 않는다(null 반환 → 항상 단독 줄).
function groupKeyOf(reference: string | null): string | null {
  if (!reference) return null;
  const m = reference.match(REFERENCE_ORDER_RE);
  if (!m) return null;
  return `${m[1]}:${m[3]}`;
}

function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// rowsAscending(오래된 것부터)을 받아서, 같은 전표에서 나온 여러 줄을
// 하나로 합친 배열을 돌려준다(여전히 오래된 것부터). 합쳐진 줄은 그
// 전표의 "가장 최근" 활동 시점 위치에 남고, 그보다 앞선 같은 전표의
// 줄들은 사라진다(다른 무관한 거래 사이에 끼어 흩어져 있던 문제 해결).
export function groupOrderCorrections(
  rowsAscending: InventoryHistoryRow[]
): GroupedInventoryHistoryRow[] {
  const groups = new Map<string, InventoryHistoryRow[]>();
  for (const row of rowsAscending) {
    const key = groupKeyOf(row.reference) ?? `__single__:${row.id}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const anchorIdToKey = new Map<string, string>();
  for (const [key, bucket] of groups) {
    anchorIdToKey.set(bucket[bucket.length - 1].id, key);
  }

  const result: GroupedInventoryHistoryRow[] = [];
  for (const row of rowsAscending) {
    const key = anchorIdToKey.get(row.id);
    if (!key) continue; // 이 전표 그룹의 앵커(최신 줄)가 아니면 건너뛴다 — 흡수됨.
    const bucket = groups.get(key)!;
    if (bucket.length === 1) {
      result.push({ ...row, correctionNote: null });
      continue;
    }

    const earliest = bucket[0];
    const anchor = bucket[bucket.length - 1];
    const origQty = Math.abs(earliest.signedQty);
    const finalQty = Math.abs(anchor.signedQty);
    // 되돌림만 있고 재반영이 없으면(anchor 자체가 adjustment) 그 전표가
    // 삭제된 것이다 — 재발행이 있으면 "N개→M개로 수정"으로 표현한다.
    const wasDeleted = anchor.type === "adjustment";
    const correctionNote = wasDeleted
      ? `${formatKoreanDate(earliest.date)} 등록된 ${origQty.toLocaleString()}개가 삭제됨`
      : `${formatKoreanDate(earliest.date)} 등록 시 ${origQty.toLocaleString()}개 → ${finalQty.toLocaleString()}개로 수정`;

    result.push({
      ...anchor,
      // 삭제된 경우 anchor(되돌림 줄) 자체엔 거래처 연결이 없으니, 누구
      // 건이었는지 알 수 있게 최초 등록분의 거래처로 보충한다.
      partnerName: anchor.partnerName ?? earliest.partnerName,
      lotNumber: anchor.lotNumber ?? earliest.lotNumber,
      correctionNote,
    });
  }

  return result;
}
