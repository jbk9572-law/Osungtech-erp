// 메일함/메신저가 아이콘을 전부 이모지(📎💬👥👤📢📝✅📧🔔)로 쓰고
// 있던 걸, 트리메뉴(tree-menu.tsx)가 이미 쓰고 있는 것과 같은 선 아이콘
// 방식(24x24 격자, 정수/반정수 좌표, stroke 1.6)으로 통일한다 —
// 이모지는 플랫폼/폰트마다 모양이 달라지고 톤도 화면과 안 맞아
// "엉성해 보인다"는 지적을 받았다.
const ICON_STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function PaperclipIcon() {
  return (
    <svg {...ICON_STROKE}>
      <path d="M18 9v8a5 5 0 0 1-10 0V7a3 3 0 0 1 6 0v9a1 1 0 0 1-2 0V9" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg {...ICON_STROKE}>
      <path d="M4 5h16v11H9l-5 4Z" />
    </svg>
  );
}

export function GroupIcon() {
  return (
    <svg {...ICON_STROKE}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-1a6 6 0 0 1 9-5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.5 14a5 5 0 0 1 6.5 5v1" />
    </svg>
  );
}

export function MegaphoneIcon() {
  return (
    <svg {...ICON_STROKE}>
      <path d="M3 10v4h3l6 4V6l-6 4Z" />
      <path d="M16 9a3 3 0 0 1 0 6" />
      <path d="M18.5 6.5a7 7 0 0 1 0 11" />
    </svg>
  );
}

export function DocumentIcon() {
  return (
    <svg {...ICON_STROKE}>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function CheckCircleIcon() {
  return (
    <svg {...ICON_STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 6-6" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg {...ICON_STROKE}>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 6l9 7 9-7" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg {...ICON_STROKE}>
      <path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg {...ICON_STROKE}>
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function ImageFileIcon() {
  return (
    <svg {...ICON_STROKE}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M5 17l5-5 4 4 2-2 3 3" />
    </svg>
  );
}

export function SpreadsheetFileIcon() {
  return (
    <svg {...ICON_STROKE}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 10h16M4 15h16M10 4v16" />
    </svg>
  );
}

export function PdfFileIcon() {
  return (
    <svg {...ICON_STROKE}>
      <path d="M7 3h7l4 4v14H7Z" />
      <path d="M14 3v4h4" />
      <path d="M9 14h1.5a1.5 1.5 0 0 0 0-3H9v6" />
      <path d="M13.5 17v-6h2" />
      <path d="M13.5 14.5H16" />
    </svg>
  );
}

export function WordFileIcon() {
  return (
    <svg {...ICON_STROKE}>
      <path d="M7 3h7l4 4v14H7Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12l1.5 6 1.5-4 1.5 4 1.5-6" />
    </svg>
  );
}

export function ArchiveFileIcon() {
  return (
    <svg {...ICON_STROKE}>
      <rect x="4" y="7" width="16" height="13" rx="1" />
      <path d="M4 7l2-4h12l2 4" />
      <path d="M10 11h4" />
    </svg>
  );
}

export function GenericFileIcon() {
  return (
    <svg {...ICON_STROKE}>
      <path d="M7 3h7l4 4v14H7Z" />
      <path d="M14 3v4h4" />
    </svg>
  );
}

const FILE_KIND_ICONS: Record<string, () => React.JSX.Element> = {
  image: ImageFileIcon,
  spreadsheet: SpreadsheetFileIcon,
  pdf: PdfFileIcon,
  word: WordFileIcon,
  archive: ArchiveFileIcon,
  file: GenericFileIcon,
};

export function FileKindIcon({ kind }: { kind: string }) {
  const Icon = FILE_KIND_ICONS[kind] ?? GenericFileIcon;
  return <Icon />;
}
