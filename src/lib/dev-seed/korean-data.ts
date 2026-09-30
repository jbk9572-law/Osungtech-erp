// 더미(테스트용) 직원/게시글 생성에 쓰는 한글 이름·부서·텍스트 풀.
// 실제 개인정보가 아니라 흔한 한국 이름/문구 조합을 무작위로 섞어
// 만든다 — 실존 인물과 일치하더라도 우연이며, 이 값들은 오직
// 테스트 데이터 생성용으로만 쓰인다.

export const SURNAMES = [
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
  "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍",
];

export const GIVEN_NAMES = [
  "민준", "서연", "도윤", "하은", "지훈", "지우", "예은", "시우", "수아", "건우",
  "채원", "현우", "다은", "준영", "유진", "재원", "소율", "민재", "은서", "태윤",
  "가은", "우진", "나윤", "성민", "혜진", "동현", "지민", "선우", "아름", "영준",
];

export function randomFullName(): string {
  return pick(SURNAMES) + pick(GIVEN_NAMES);
}

export const DEPARTMENTS = ["영업1팀", "영업2팀", "생산팀", "품질관리팀", "구매팀", "관리팀", "물류팀"];

export const POSITIONS = ["사원", "주임", "대리", "과장", "차장", "팀장"];

export const COMPANY_SUFFIXES = ["테크", "산업", "필름", "케미칼", "머티리얼즈", "무역", "시스템", "인더스트리"];
export const COMPANY_PREFIXES = ["한빛", "대성", "동양", "삼원", "우신", "미래", "성진", "일신", "코스텍", "그린텍"];

export function randomCompanyName(): string {
  return pick(COMPANY_PREFIXES) + pick(COMPANY_SUFFIXES);
}

export const PRODUCT_NAMES = [
  "산업용 센서 모듈 A", "제어 보드 기본형", "필터 원단 A", "정밀 베어링 세트",
  "방수 커넥터", "알루미늄 프레임 60x40", "PVC 파이프 커넥터", "고정밀 압력계",
  "산업용 모터 1HP", "케이블 트레이 300mm",
];

export const PRODUCT_SPECS = ["표준형", "대형", "소형", "방수형", "고내열형", "경량형"];

export const ANNOUNCEMENT_TITLES = [
  "정기 안전점검 계획 공지",
  "사내 회식비 정산 규정 변경 안내",
  "휴게실 리모델링 공사 안내",
  "하계휴가 신청 관련 공지",
  "사내 전산망 점검 예정 안내",
  "신규 협력업체 등록 안내",
  "월간 생산 실적 공유",
  "화재 대피 훈련 실시 안내",
];

export const TODO_TITLES = [
  "재고 실사 확인 요청",
  "발주서 검토 요청",
  "샘플 발송 준비",
  "거래명세서 재발행 요청",
  "품질 검사 결과 확인",
  "납기 일정 조율",
];

export const MAIL_SUBJECTS = [
  "발주서 확인 요청드립니다",
  "세금계산서 발행 안내",
  "샘플 배송 관련 문의",
  "견적서 회신드립니다",
  "납기 일정 조정 요청",
  "계약서 검토 부탁드립니다",
];

export const MESSENGER_LINES = [
  "확인했습니다, 감사합니다.",
  "오늘 오후에 처리하겠습니다.",
  "자료 공유드립니다.",
  "잠시 회의 다녀오겠습니다.",
  "네 알겠습니다!",
  "내일 오전에 다시 확인해볼게요.",
];

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickMany<T>(arr: readonly T[], count: number): T[] {
  const pool = [...arr];
  const result: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}
