alter table public.notes enable row level security;

create policy "anyone can read notes"
  on public.notes for select
  using (true);

create policy "anyone can write a note"
  on public.notes for insert
  with check (true);
