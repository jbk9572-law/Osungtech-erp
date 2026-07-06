"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
    >
      인쇄하기
    </button>
  );
}
