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

// body는 이제 스마트에디터(리치텍스트)로 작성된 HTML이라, 그대로
// dangerouslySetInnerHTML로 렌더링된다 — 치환해 넣는 값(직원 이름 등,
// 병합필드 입력칸에 사람이 직접 타이핑한 문자열)에 "<"/"&" 같은 HTML
// 특수문자가 섞여 있으면 마크업이 깨지거나 최악의 경우 스크립트 삽입
// 통로가 될 수 있어, 치환 시점에 반드시 이스케이프한다. 원본 양식
// body 자체는 에디터(Tiptap) 스키마로 이미 제한돼 있어 이스케이프
// 대상이 아니다.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(FIELD_PATTERN, (_match, name: string) => {
    const value = values[name];
    return value !== undefined ? escapeHtml(value) : "";
  });
}

// 리치텍스트(HTML)로 저장된 양식 body를, 아직 리치에디터로 전환 안 된
// 화면(예: 전자결재 작성의 일반 textarea "내용" 칸)에 프리필할 때 쓴다
// — 태그를 벗겨 사람이 읽을 수 있는 일반 텍스트로 근사한다. 블록
// 요소(p/div/li/h1-6) 경계와 <br>은 줄바꿈으로 살리고, 나머지 태그는
// 제거한다.
export function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  if (typeof document === "undefined") {
    return withBreaks
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const el = document.createElement("div");
  el.innerHTML = withBreaks;
  return (el.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

// 자동 채움 후보 — 필드명이 이 키와 정확히 같을 때만 값을 미리 채워주고,
// 그 외 필드는 전부 사람이 직접 입력한다(잘못 추측해서 채우는 것보다
// 빈칸이 안전하다). representative_name/department_name/position_title/
// hire_date는 재직증명서 등 기본 제공 양식이 매번 같은 값(회사 대표자,
// 선택한 직원의 소속·직위·입사일)을 반복 입력하게 만들지 않으려고
// company_profile/profiles에서 그대로 끌어온다 — 실제 값 매핑은
// generate-document-form.tsx의 applyAutoFill 참고.
export const AUTO_FILL_FIELD_KEYS = [
  "company_name",
  "employee_name",
  "representative_name",
  "department_name",
  "position_title",
  "hire_date",
] as const;

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
