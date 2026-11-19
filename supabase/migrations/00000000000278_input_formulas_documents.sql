-- 계산식 공용 저장소(277)를 견적서·구매요청서에도 연결 — 문서(견적서·구매요청서·구매견적요청서)를 지우면 그 문서의 식도 같이 지운다.
drop trigger if exists quotes_delete_formulas on public.quotes;
create trigger quotes_delete_formulas after delete on public.quotes
  for each row execute function public.delete_input_formulas_of_entity('quote');
drop trigger if exists purchase_requests_delete_formulas on public.purchase_requests;
create trigger purchase_requests_delete_formulas after delete on public.purchase_requests
  for each row execute function public.delete_input_formulas_of_entity('purchase_request');
drop trigger if exists purchase_quote_requests_delete_formulas on public.purchase_quote_requests;
create trigger purchase_quote_requests_delete_formulas after delete on public.purchase_quote_requests
  for each row execute function public.delete_input_formulas_of_entity('purchase_quote_request');
