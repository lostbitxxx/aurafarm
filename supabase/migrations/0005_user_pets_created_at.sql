-- Some desks were created before user_pets.created_at existed.
-- Adding it keeps the table aligned with 0001. The dashboard does not read this column.

alter table public.user_pets
  add column if not exists created_at timestamptz not null default now();
