-- 08-add-judge-access-token.sql
-- Add QR token support for judges (token-based auth)

-- Ensure gen_random_uuid() exists
create extension if not exists pgcrypto;

alter table public.judges
  add column if not exists access_token uuid not null default gen_random_uuid();

-- Make tokens unique so a token identifies exactly one judge
create unique index if not exists judges_access_token_uidx
  on public.judges(access_token);

