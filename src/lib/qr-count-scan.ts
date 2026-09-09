// QR 자동실사 화면의 핵심 로직 — 카메라/디코딩 같은 부수효과 없이, "지금까지
// 스캔된 상태 + 새로 인식된 QR 값"만으로 다음 상태를 결정하는 순수 함수로
// 뽑아냈다. 이렇게 해야 "다음 QR을 찍으면 이전 것은 자동으로 일치 처리된다"
// 같은 규칙을 카메라 없이도 테스트할 수 있다.

export type ScanProduct = {
  productId: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string | null;
  systemQuantity: number;
  basePackageQty: number | null;
};

// 시스템 수량과 다르게(실제로) 센 값으로 확정된 품목 — 실사 저장 대상.
export type ConfirmedMismatch = {
  productId: string;
  systemQuantity: number;
  countedQuantity: number;
};

export type ScanState = {
  // 지금 카메라에 마지막으로 잡혀서 화면에 정보가 떠 있는 품목 — 아직
  // "일치/불일치"가 확정되지 않은 상태.
  active: ScanProduct | null;
  // QR을 읽었는데 등록된 품목을 찾을 수 없을 때(오타/다른 QR 등)만 채워진다.
  unknownSku: string | null;
  // 스캔 흐름을 한 번이라도 거친(일치든 불일치든) 품목 id 모음 — 같은
  // 품목을 실수로 두 번 스캔해도 "스캔 건수"가 중복으로 올라가지 않게 한다.
  confirmedIds: Set<string>;
  mismatches: ConfirmedMismatch[];
};

export function createInitialScanState(): ScanState {
  return { active: null, unknownSku: null, confirmedIds: new Set(), mismatches: [] };
}

// 보관위치(랙) QR은 품목 QR과 달리 SKU가 아니라 그 위치 상세 페이지의
// URL을 통째로 인코딩해서 만든다(print/page.tsx의 buildLocationUrl 참고).
// 이 화면(QR 자동실사)에서 같은 카메라로 위치 QR을 찍었을 때 "등록 안 된
// SKU"로 오인하지 않고 위치 조회로 분기할 수 있게, 디코딩된 값이 위치
// URL이면 코드만 뽑아낸다 — 아니면 null(품목 SKU로 계속 처리).
const LOCATION_QR_PATTERN = /\/inventory\/locations\/([A-Za-z0-9-]+)(?:[/?#]|$)/;

export function extractLocationCodeFromQr(decodedValue: string): string | null {
  const m = decodedValue.match(LOCATION_QR_PATTERN);
  return m ? m[1] : null;
}

// 지금 화면에 떠 있는 품목(active)을 "일치"로 확정한다 — 다음 QR을
// 스캔했을 때, 그리고 "실사 종료" 시 마지막 품목에 대해 호출된다.
function confirmActiveAsMatched(state: ScanState): ScanState {
  if (!state.active || state.confirmedIds.has(state.active.productId)) return state;
  const confirmedIds = new Set(state.confirmedIds);
  confirmedIds.add(state.active.productId);
  return { ...state, confirmedIds };
}

// 새 QR 값을 읽었을 때 호출한다. 지금 떠 있는 품목과 같은 값이면(같은
// 태그를 카메라에 계속 대고 있는 경우) 아무 것도 바뀌지 않는다 — 이
// "값이 실제로 달라졌을 때만 반응한다"는 규칙 자체가 디바운스 역할을 해서,
// 같은 QR을 계속 반복 인식해도 "다음 걸로 넘어감"이 반복 발동하지 않는다.
export function onQrDecoded(
  state: ScanState,
  decodedValue: string,
  productBySku: Map<string, ScanProduct>,
): ScanState {
  if (state.active?.sku === decodedValue) return state;

  const next = confirmActiveAsMatched(state);
  const product = productBySku.get(decodedValue);
  if (!product) {
    return { ...next, active: null, unknownSku: decodedValue };
  }
  return { ...next, active: product, unknownSku: null };
}

// "수량 다름" 확정 — 지금 떠 있는 품목을 실제로 센 수량으로 기록하고,
// 다음 스캔을 받을 준비 상태로 되돌린다(active를 비워서, 같은 품목을
// 다시 비추기 전까진 정보 패널이 안 남아있게 한다).
//
// 같은 품목을 실수로(또는 정정하려고) 두 번 "수량 다름"으로 확정하면,
// 예전엔 mismatches에 그 품목이 두 번 들어가 저장 시 두 델타가 모두
// 재고에 반영돼(예: 두 번째로 고쳐 입력한 값이 아니라 두 델타의 합만큼)
// 최종 재고가 틀어졌다. 같은 productId의 기존 항목을 지우고 이번
// 값으로만 남겨서, 마지막으로 확정한 수량만 반영되게 한다.
export function confirmMismatch(state: ScanState, countedQuantity: number): ScanState {
  if (!state.active) return state;
  const confirmedIds = new Set(state.confirmedIds);
  confirmedIds.add(state.active.productId);
  return {
    ...state,
    active: null,
    confirmedIds,
    mismatches: [
      ...state.mismatches.filter((m) => m.productId !== state.active!.productId),
      { productId: state.active.productId, systemQuantity: state.active.systemQuantity, countedQuantity },
    ],
  };
}

// 실사 종료 버튼을 누른 시점에 아직 확정 안 된(카메라에 마지막으로 잡혀
// 있던) 품목까지 일치로 마무리한다.
export function finalizeScanSession(state: ScanState): ScanState {
  return confirmActiveAsMatched(state);
}
