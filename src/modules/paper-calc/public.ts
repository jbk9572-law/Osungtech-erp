// 모조지 모듈이 핵심 화면(서버/클라이언트 어디서든)에 공개하는 "순수·서버 안전" API.
// 핵심 코드는 모듈 내부 파일(lib/, components/)을 직접 import하지 말고 이 입구와
// order-form / order-actions / actions / ui 입구만 쓴다 — scripts/check-module-boundary.mjs가 강제한다.
export { PAPER_STOCK_SKU, isPaperCalcEnabled } from "@/modules/paper-calc/lib/paper-calc-sync";
export {
  formatPaperCalcSizeLines,
  mergePaperCalcInputItems,
  type PaperCalcSizeRow,
} from "@/modules/paper-calc/lib/paper-calc-summary";
