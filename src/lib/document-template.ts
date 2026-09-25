// 문서 템플릿(인사서류/전자결재 공용) 병합필드 엔진. 서버/클라이언트
// 양쪽에서 같은 로직을 써야 "미리보기(클라이언트)"와 "실제 저장값
// (서버)"이 어긋나지 않는다 — 그래서 프레임워크 의존 없는 순수 함수로
// 뺐다.
//
// 문법은 {{field_name}} 하나뿐이다(조건부/반복 블록 없음) — 근로계약서
// 같은 실제 양식은 휴게시간 여러 구간처럼 반복 섹션이 있을 수 있지만,
// 그건 다음 확장으로 미루고 1차는 단순 치환만 지원한다.
const FIELD_PATTERN = /\{\{([a-zA-Z0-9_]+)\}\}/g;

export function extractTemplateFields(body: string): string[] {
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const match of body.matchAll(FIELD_PATTERN)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      fields.push(name);
    }
  }
  return fields;
}

export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(FIELD_PATTERN, (_match, name: string) => values[name] ?? "");
}

// 자동 채움 후보 — 필드명이 이 키와 정확히 같을 때만 값을 미리 채워주고,
// 그 외 필드는 전부 사람이 직접 입력한다(잘못 추측해서 채우는 것보다
// 빈칸이 안전하다).
export const AUTO_FILL_FIELD_KEYS = ["company_name", "employee_name"] as const;

// "서버 자동" 필드 — 위 AUTO_FILL_FIELD_KEYS(입력칸은 그대로 두고 값만
// 미리 채워주는 것)와 달리, 이 필드들은 애초에 문서 생성 화면에 입력칸
// 자체가 안 보인다. 오늘 날짜처럼 사람이 고칠 이유가 없는 값을 양식
// 작성자가 {{today}}로 본문에 넣어두면, 문서를 실제로 생성하는 시점에
// 서버가 그때그때 값을 채운다(hr/documents/actions.ts의 createDocument
// 참고) — 양식을 미리 만들어둬도 나중에 생성할 때마다 그날 날짜로
// 맞게 나온다. 값 계산 자체은 supabase/현재 사용자가 필요해 서버
// 전용이라, 여기 lib(순수 함수, 서버/클라이언트 공용)에는 "이 이름이
// 서버 자동 필드인지"와 "화면에 뭐라고 보여줄지"만 두고 실제 값 계산은
// actions.ts에 둔다.
export const SERVER_AUTO_FIELD_LABELS: Record<string, string> = {
  today: "오늘 날짜 (자동)",
  author_name: "작성자 (자동)",
};

export function isServerAutoField(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SERVER_AUTO_FIELD_LABELS, name);
}
