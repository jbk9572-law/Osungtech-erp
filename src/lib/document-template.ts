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
