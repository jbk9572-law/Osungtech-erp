-- 계산식 공용 저장소(277)를 할일에도 연결 — 할일을 지우면 그 식도 같이 지운다.
drop trigger if exists todos_delete_formulas on public.todos;
create trigger todos_delete_formulas after delete on public.todos
  for each row execute function public.delete_input_formulas_of_entity('todo');
