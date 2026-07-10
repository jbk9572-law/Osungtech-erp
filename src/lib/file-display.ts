const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const EXCEL_EXTENSIONS = ["xlsx", "xls", "csv"];
const PDF_EXTENSIONS = ["pdf"];
const WORD_EXTENSIONS = ["doc", "docx"];
const ARCHIVE_EXTENSIONS = ["zip", "rar", "7z"];

function extOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.includes(extOf(fileName));
}

export function fileKindIcon(fileName: string): string {
  const ext = extOf(fileName);
  if (IMAGE_EXTENSIONS.includes(ext)) return "🖼️";
  if (EXCEL_EXTENSIONS.includes(ext)) return "📊";
  if (PDF_EXTENSIONS.includes(ext)) return "📕";
  if (WORD_EXTENSIONS.includes(ext)) return "📘";
  if (ARCHIVE_EXTENSIONS.includes(ext)) return "🗜️";
  return "📄";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
