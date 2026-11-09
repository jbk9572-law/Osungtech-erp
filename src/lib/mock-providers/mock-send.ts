// 세금계산서(국세청)/팩스/알림톡·문자는 지금 코드베이스에 실제 외부
// API 연동이 전혀 없다(플랫폼 애드온(결제 대상)으로만 존재 — addon-
// kind.ts). 사용자 요청으로 "테스트용 가짜 발송 엔드포인트"를 만든다 —
// 실제 요금이 드는 외부 서비스를 붙이지 않고도, 애드온을 켠 테넌트가
// 이 화면들이 실제로 어떻게 동작할지 미리 확인해볼 수 있게 한다. 실제
// 연동(홈택스/팝빌/카카오 알림톡 등)으로 교체할 때는 이 파일의 세
// 함수(sendMockFax/sendMockAlimtalk/issueMockTaxInvoice)를 실제 API
// 호출로 바꾸고 호출부는 그대로 두면 된다 — 반환 타입(MockSendResult)만
// 유지하면 된다.

export type MockSendResult =
  | { success: true; trackingId: string; sentAt: string }
  | { success: false; error: string };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomTrackingId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// 실제 팩스 발송은 보통 1~3초 걸리고 상대방 회선 상태에 따라 실패할 수
// 있다 — 그 체감을 흉내내려고 지연 + 낮은 확률의 실패를 섞는다(100%
// 성공만 하면 "진짜처럼" 테스트해보는 의미가 줄어든다).
export async function sendMockFax(input: { toName: string; title: string }): Promise<MockSendResult> {
  await delay(400 + Math.random() * 600);
  if (!input.toName.trim()) return { success: false, error: "수신처 이름이 없습니다." };
  if (Math.random() < 0.05) {
    return { success: false, error: `${input.toName} 팩스 회선이 통화중입니다(테스트 — 실제 발송 아님). 잠시 후 다시 시도해주세요.` };
  }
  return { success: true, trackingId: randomTrackingId("FAX"), sentAt: new Date().toISOString() };
}

export async function sendMockAlimtalk(input: { toName: string; message: string }): Promise<MockSendResult> {
  await delay(300 + Math.random() * 400);
  if (!input.toName.trim()) return { success: false, error: "수신처 이름이 없습니다." };
  if (Math.random() < 0.03) {
    return { success: false, error: `${input.toName}님에게 알림톡 발송이 실패했습니다(테스트 — 실제 발송 아님). 문자로 대체 발송됩니다.` };
  }
  return { success: true, trackingId: randomTrackingId("ALIM"), sentAt: new Date().toISOString() };
}

export type MockTaxInvoiceResult = MockSendResult & { ntsConfirmNumber?: string };

// 국세청 전자세금계산서 발행은 성공하면 승인번호(국세청 전송 확인번호)를
// 돌려준다 — 실제 발행 화면(세금계산서 상세)의 "참고" 란에 그대로 남겨
// 실제 API를 붙였을 때와 같은 자리에 같은 모양으로 보이게 한다.
export async function issueMockTaxInvoice(input: { customerName: string; totalAmount: number }): Promise<MockTaxInvoiceResult> {
  await delay(500 + Math.random() * 700);
  if (!input.customerName.trim() || !(input.totalAmount > 0)) {
    return { success: false, error: "발행할 거래처 또는 금액 정보가 없습니다." };
  }
  if (Math.random() < 0.04) {
    return { success: false, error: "국세청 전자세금계산서 시스템 응답이 지연되고 있습니다(테스트 — 실제 발행 아님). 잠시 후 다시 시도해주세요." };
  }
  const trackingId = randomTrackingId("NTS");
  return { success: true, trackingId, sentAt: new Date().toISOString(), ntsConfirmNumber: trackingId };
}
