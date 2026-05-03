alter table public.notes
  add column resolved boolean not null default false;

create policy "anyone can update a note"
  on public.notes for update
  using (true)
  with check (true);
