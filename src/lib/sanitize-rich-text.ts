import sanitizeHtml from "sanitize-html";

// 공지사항/전자결재/공문/문서양식/고객지원 문의 — 전부 RichTextEditor(TipTap)로
// 작성된 HTML을 DB에 저장했다가 서버 컴포넌트에서 dangerouslySetInnerHTML로
// 그대로 그린다. 에디터의 스키마가 제한돼 있어 "에디터로는" <script> 등을
// 만들 수 없지만, 그건 클라이언트 UI 제약일 뿐이다 — 서버 액션은 FormData로
// 들어온 문자열을 검증 없이 그대로 저장하므로, 에디터를 거치지 않고 폼을
// 직접 조작/재전송하면 임의 HTML을 저장할 수 있고 그게 다른 사용자(관리자,
// 심지어 플랫폼 운영자)의 화면에서 그대로 실행되는 저장형 XSS가 된다.
// 그래서 "쓸 때"가 아니라 "그릴 때" 공용으로 한 번 더 걸러낸다 — 모든
// dangerouslySetInnerHTML 호출부가 RichTextView를 거치게 하면 된다.
//
// 허용 태그/속성은 RichTextEditor가 실제로 만들어내는 마크업(StarterKit +
// Underline/Image/TextAlign/TextStyle+FontSize/Color/Highlight/Table/
// Subscript/Superscript)만 반영한다. style은 그 확장들이 실제로 쓰는
// 4개 속성(color/background-color/text-align/font-size)만 통과시킨다.
const ALLOWED_STYLE_VALUES = {
  color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d.,%\s]+\)$/],
  "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d.,%\s]+\)$/],
  "text-align": [/^(left|right|center|justify)$/],
  "font-size": [/^\d+(\.\d+)?(px|em|rem|%)$/],
};

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr",
    "strong", "b", "em", "i", "s", "strike", "del", "u", "mark", "sub", "sup", "span",
    "h1", "h2", "h3",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "table", "thead", "tbody", "tr", "th", "td",
    "img", "a",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    "*": ["style"],
  },
  allowedStyles: {
    "*": ALLOWED_STYLE_VALUES,
  },
  // RichTextEditor는 이미지도 URL 입력만 지원한다(업로드 저장소 없음) —
  // data: 스킴으로 들어올 이유가 없으니 http(s)만 허용해 data:/javascript:
  // 둘 다 막는다.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
