"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapImage from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";

export type RichTextEditorHandle = {
  // 병합필드 삽입 버튼처럼, 외부에서 지금 커서 위치에 텍스트를 끼워
  // 넣어야 할 때 쓴다(document-template-form.tsx의 "자동 필드 삽입"
  // 버튼 참고).
  insertText: (text: string) => void;
};

type Props = {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

// 트리메뉴/그룹웨어 아이콘(groupware-icons.tsx)과 같은 선 아이콘
// 규칙(24x24, stroke 1.6, round cap/join) — 툴바 버튼이 전부 이 틀을
// 따른다. 굵게/기울임/밑줄/취소선처럼 글자 자체가 아이콘인 버튼만
// 예외로 텍스트를 직접 그린다(서체로 그리는 게 손으로 그린 path보다
// 훨씬 또렷하다).
const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function LetterIcon({ children, style }: { children: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24">
      <text x="12" y="17" textAnchor="middle" fontSize="15" fill="currentColor" stroke="none" style={style}>
        {children}
      </text>
    </svg>
  );
}

const BoldIcon = () => <LetterIcon style={{ fontWeight: 800 }}>B</LetterIcon>;
const ItalicIcon = () => <LetterIcon style={{ fontStyle: "italic", fontWeight: 600 }}>I</LetterIcon>;
const StrikeIcon = () => (
  <svg viewBox="0 0 24 24">
    <text x="12" y="17" textAnchor="middle" fontSize="15" fill="currentColor" stroke="none">
      S
    </text>
    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const UnderlineIcon = () => (
  <svg viewBox="0 0 24 24">
    <text x="12" y="15" textAnchor="middle" fontSize="15" fill="currentColor" stroke="none">
      U
    </text>
    <line x1="6" y1="19" x2="18" y2="19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const Heading1Icon = () => <LetterIcon style={{ fontWeight: 800 }}>H1</LetterIcon>;
const Heading2Icon = () => <LetterIcon style={{ fontWeight: 800 }}>H2</LetterIcon>;

function UndoIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 7 3 11l4 4" />
      <path d="M3 11h11a6 6 0 0 1 0 12h-2" />
    </svg>
  );
}
function RedoIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M17 7l4 4-4 4" />
      <path d="M21 11H10a6 6 0 0 0 0 12h2" />
    </svg>
  );
}
function BulletListIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9 6h11M9 12h11M9 18h11" />
    </svg>
  );
}
function OrderedListIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <text x="3" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
      <text x="3" y="14" fontSize="7" fill="currentColor" stroke="none">2</text>
      <text x="3" y="20" fontSize="7" fill="currentColor" stroke="none">3</text>
      <path
        d="M9 6h11M9 12h11M9 18h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function BlockquoteIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 5v14" />
      <path d="M10 8h9M10 12h9M10 16h6" />
    </svg>
  );
}
function CodeBlockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 8 5 12l4 4" />
      <path d="M15 8l4 4-4 4" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M8.3 12.7a3.8 3.8 0 0 1 0-5.4l1.8-1.8a3.8 3.8 0 0 1 5.4 5.4l-.9.9" />
      <path d="M15.7 11.3a3.8 3.8 0 0 1 0 5.4l-1.8 1.8a3.8 3.8 0 0 1-5.4-5.4l.9-.9" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
      <circle cx="8.5" cy="9.5" r="1.4" />
      <path d="M20.5 15.5 16 11l-4.5 4.5" />
      <path d="M11.5 18.5 8.5 15.5l-5 5" />
    </svg>
  );
}
function TableIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15" />
    </svg>
  );
}
function AlignLeftIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 6h16M4 12h10M4 18h13" />
    </svg>
  );
}
function AlignCenterIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 6h16M7 12h10M5.5 18h13" />
    </svg>
  );
}
function AlignRightIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 6h16M10 12h10M7 18h13" />
    </svg>
  );
}
function TextColorIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path
        d="M9.5 15 12 7l2.5 8M10.2 12.6h3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="5" y="18" width="14" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function HighlightIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 19h4l10-10-4-4L5 15Z" />
      <path d="M13.5 5.5 18.5 10.5" />
    </svg>
  );
}

const TEXT_COLORS = [
  { label: "기본", value: null },
  { label: "빨강", value: "#c9302c" },
  { label: "초록", value: "#1a7a33" },
  { label: "주황", value: "#a15c00" },
  { label: "파랑", value: "#3730a3" },
];
const HIGHLIGHT_COLORS = [
  { label: "지우기", value: null },
  { label: "노랑", value: "#fff7d6" },
  { label: "초록", value: "#e7f6ea" },
  { label: "주황", value: "#fff3e0" },
  { label: "빨강", value: "#fdeaec" },
  { label: "파랑", value: "#eef2ff" },
];

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="erp-richtext-toolbar-btn erp-richtext-toolbar-icon-btn"
      data-active={active ? "1" : undefined}
    >
      <span className="erp-icon" aria-hidden style={{ width: 15, height: 15 }}>
        {children}
      </span>
    </button>
  );
}

// 문서 양식(document_templates.body)/공문 본문(official_documents.body)을
// 순수 텍스트가 아니라 실제 서식(굵게/제목/목록/표/이미지 등)이 있는
// 문서처럼 작성할 수 있게 하는 공용 리치텍스트 에디터. Tiptap(ProseMirror
// 기반)을 쓴다 — 에디터가 만들어내는 HTML이 자체 스키마로 제한돼 있어
// (임의 <script> 태그 등을 붙여넣거나 입력할 방법이 없음) 직접
// contentEditable/innerHTML을 다루는 것보다 안전하다.
//
// 값은 HTML 문자열로 오간다(editor.getHTML()) — {{field_name}} 같은
// 병합필드 토큰은 그냥 일반 텍스트로 취급되므로 lib/document-template.ts의
// 정규식 기반 추출/치환 로직이 그대로 동작한다(HTML 태그에 둘러싸여
// 있어도 정규식 매칭에는 영향 없음).
//
// 이미지는 별도 업로드 저장소 없이 URL 입력만 지원한다 — 업로드까지
// 필요해지면 그때 Supabase Storage 버킷을 추가로 연결한다.
export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  { id, value, onChange, placeholder, minHeight = 220 },
  ref,
) {
  const [openPopover, setOpenPopover] = useState<"link" | "image" | "color" | "highlight" | null>(null);
  const [popoverUrl, setPopoverUrl] = useState("");
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      TiptapImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    // Next.js는 클라이언트 컴포넌트도 서버에서 먼저 렌더링하는데,
    // Tiptap은 그 시점에 에디터를 즉시 만들면 하이드레이션 결과가
    // 어긋난다고 경고한다 — 마운트 후에만 만들게 한다.
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "erp-richtext-content",
        ...(id ? { id } : {}),
      },
    },
  });

  // 저장 성공 후 폼이 리셋되거나, 병합필드 값이 바뀌어 상위에서 body를
  // 다시 계산해 넘기는 경우(official-document-form.tsx의 템플릿 미리보기)
  // 등, 사용자가 직접 타이핑한 게 아닌 외부 변경을 에디터에도 반영한다.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // 팝오버(링크/이미지 주소 입력) 바깥을 클릭하면 닫는다.
  useEffect(() => {
    if (!openPopover) return;
    function onClickOutside(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openPopover]);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
    }),
    [editor],
  );

  if (!editor) {
    return <div className="erp-richtext-content" style={{ minHeight }} />;
  }

  // 아래 핸들러들은 이미 위에서 editor가 null이면 함수 컴포넌트가
  // 일찍 리턴해버린 뒤에만 실제로 호출되지만(그래서 null일 수 없지만),
  // 클로저라 TypeScript가 그 흐름을 못 따라와 null 아님을 단언한다.
  function openLinkPopover() {
    setPopoverUrl(editor!.getAttributes("link").href ?? "");
    setOpenPopover(openPopover === "link" ? null : "link");
  }

  function applyLink() {
    const url = popoverUrl.trim();
    if (!url) {
      editor!.chain().focus().unsetLink().run();
    } else {
      editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setOpenPopover(null);
    setPopoverUrl("");
  }

  function applyImage() {
    const url = popoverUrl.trim();
    if (url) editor!.chain().focus().setImage({ src: url }).run();
    setOpenPopover(null);
    setPopoverUrl("");
  }

  return (
    <div className="erp-richtext">
      <div className="erp-richtext-toolbar" ref={toolbarRef}>
        <ToolbarButton title="실행 취소 (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
          <UndoIcon />
        </ToolbarButton>
        <ToolbarButton title="다시 실행 (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}>
          <RedoIcon />
        </ToolbarButton>
        <span className="erp-richtext-toolbar-sep" />
        <ToolbarButton
          title="제목 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1Icon />
        </ToolbarButton>
        <ToolbarButton
          title="제목 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2Icon />
        </ToolbarButton>
        <span className="erp-richtext-toolbar-sep" />
        <ToolbarButton
          title="굵게 (Ctrl+B)"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton
          title="기울임 (Ctrl+I)"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton
          title="밑줄 (Ctrl+U)"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton
          title="취소선"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikeIcon />
        </ToolbarButton>
        <span className="erp-richtext-toolbar-sep" />
        <div style={{ position: "relative" }}>
          <ToolbarButton
            title="글자 색"
            active={!!editor.getAttributes("textStyle").color}
            onClick={() => setOpenPopover(openPopover === "color" ? null : "color")}
          >
            <TextColorIcon />
          </ToolbarButton>
          {openPopover === "color" && (
            <div className="erp-richtext-popover" role="menu">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className="erp-richtext-swatch-row"
                  onClick={() => {
                    if (c.value) editor.chain().focus().setColor(c.value).run();
                    else editor.chain().focus().unsetColor().run();
                    setOpenPopover(null);
                  }}
                >
                  <span
                    className="erp-richtext-swatch"
                    style={{ background: c.value ?? "var(--erp-text)" }}
                    aria-hidden
                  />
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <ToolbarButton
            title="형광펜"
            active={editor.isActive("highlight")}
            onClick={() => setOpenPopover(openPopover === "highlight" ? null : "highlight")}
          >
            <HighlightIcon />
          </ToolbarButton>
          {openPopover === "highlight" && (
            <div className="erp-richtext-popover" role="menu">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className="erp-richtext-swatch-row"
                  onClick={() => {
                    if (c.value) editor.chain().focus().setHighlight({ color: c.value }).run();
                    else editor.chain().focus().unsetHighlight().run();
                    setOpenPopover(null);
                  }}
                >
                  <span
                    className="erp-richtext-swatch"
                    style={{ background: c.value ?? "var(--erp-panel)", borderStyle: c.value ? "solid" : "dashed" }}
                    aria-hidden
                  />
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="erp-richtext-toolbar-sep" />
        <ToolbarButton
          title="왼쪽 정렬"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeftIcon />
        </ToolbarButton>
        <ToolbarButton
          title="가운데 정렬"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenterIcon />
        </ToolbarButton>
        <ToolbarButton
          title="오른쪽 정렬"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRightIcon />
        </ToolbarButton>
        <span className="erp-richtext-toolbar-sep" />
        <ToolbarButton
          title="글머리 기호 목록"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <BulletListIcon />
        </ToolbarButton>
        <ToolbarButton
          title="번호 매기기 목록"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <OrderedListIcon />
        </ToolbarButton>
        <ToolbarButton
          title="인용구"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <BlockquoteIcon />
        </ToolbarButton>
        <ToolbarButton
          title="코드 블록"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <CodeBlockIcon />
        </ToolbarButton>
        <span className="erp-richtext-toolbar-sep" />
        <div style={{ position: "relative" }}>
          <ToolbarButton title="링크" active={editor.isActive("link")} onClick={openLinkPopover}>
            <LinkIcon />
          </ToolbarButton>
          {openPopover === "link" && (
            <div className="erp-richtext-popover erp-richtext-popover-input">
              <input
                type="text"
                autoComplete="off"
                autoFocus
                value={popoverUrl}
                onChange={(e) => setPopoverUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                  if (e.key === "Escape") setOpenPopover(null);
                }}
                placeholder="https://..."
                className="erp-input"
                style={{ fontSize: 12, height: 26 }}
              />
              <button type="button" className="erp-btn erp-btn-primary" onClick={applyLink} style={{ height: 26, fontSize: 11.5 }}>
                적용
              </button>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <ToolbarButton
            title="이미지 (URL)"
            onClick={() => setOpenPopover(openPopover === "image" ? null : "image")}
          >
            <ImageIcon />
          </ToolbarButton>
          {openPopover === "image" && (
            <div className="erp-richtext-popover erp-richtext-popover-input">
              <input
                type="text"
                autoComplete="off"
                autoFocus
                value={popoverUrl}
                onChange={(e) => setPopoverUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyImage();
                  }
                  if (e.key === "Escape") setOpenPopover(null);
                }}
                placeholder="이미지 URL"
                className="erp-input"
                style={{ fontSize: 12, height: 26 }}
              />
              <button type="button" className="erp-btn erp-btn-primary" onClick={applyImage} style={{ height: 26, fontSize: 11.5 }}>
                삽입
              </button>
            </div>
          )}
        </div>
        <ToolbarButton
          title="표 삽입"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} style={{ minHeight }} />
    </div>
  );
});
