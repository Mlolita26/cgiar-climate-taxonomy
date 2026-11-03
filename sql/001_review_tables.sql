-- Tagging review: tables, access rules and the status view.
-- Paste the whole file into Supabase > SQL Editor > New query > Run. Safe to run again.

create table if not exists rv_terms (
  id               text primary key,
  term             text not null,
  facet            text,
  level            int,
  parent_id        text,
  synonyms         text[] not null default '{}',
  definition       text,
  role_adaptation  text,   -- stand-alone | context-dependent | (empty = not on this axis)
  role_mitigation  text,
  climate_area     text,
  taxonomy_version text
);

create table if not exists rv_batches (
  id               text primary key,
  name             text,
  taxonomy_version text,
  created_at       timestamptz not null default now()
);

create table if not exists rv_results (
  id                     text primary key,
  batch_id               text references rv_batches(id) on delete cascade,
  title                  text,
  description            text,
  climate_marker         text,
  level                  text,
  type                   text,
  ai_adaptation          text,
  ai_mitigation          text,
  ai_scope               text,
  ai_adaptation_elements text[] not null default '{}',
  ai_mitigation_elements text[] not null default '{}',
  ai_adaptation_pathway  text,
  ai_mitigation_pathway  text,
  ai_tags                jsonb not null default '[]',
  created_at             timestamptz not null default now()
);

create table if not exists rv_reviewers (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists rv_reviews (
  id                 bigint generated always as identity primary key,
  result_id          text not null references rv_results(id) on delete cascade,
  reviewer_id        uuid not null default auth.uid() references auth.users(id),
  submitted          boolean not null default false,
  adaptation_ok      boolean,
  adaptation_verdict text,          -- the reviewer's verdict when adaptation_ok = false
  mitigation_ok      boolean,
  mitigation_verdict text,
  tag_decisions      jsonb not null default '{}',   -- {"CONCEPT_ID": "agree" | "disagree"}
  added_terms        text[] not null default '{}',  -- taxonomy IDs the reviewer added
  proposals          jsonb not null default '[]',   -- [{"kind":"new"|"synonym","label":..,"facet":..,"of_id":..,"note":..}]
  comment            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (result_id, reviewer_id)
);
create index if not exists rv_reviews_result on rv_reviews(result_id);

-- number of submitted reviews of a result, readable whatever the row access rules
create or replace function rv_submitted_count(rid text) returns int
language sql stable security definer set search_path = public
as $$ select count(*)::int from rv_reviews where result_id = rid and submitted $$;

-- one row per result: how many reviews are started and submitted (counts only, no answers)
create or replace view rv_result_status as
select r.id as result_id, r.batch_id,
       (select count(*) from rv_reviews v where v.result_id = r.id)::int                 as n_started,
       (select count(*) from rv_reviews v where v.result_id = r.id and v.submitted)::int as n_submitted
from rv_results r;
revoke all on rv_result_status from anon;
grant select on rv_result_status to authenticated;

alter table rv_terms     enable row level security;
alter table rv_batches   enable row level security;
alter table rv_results   enable row level security;
alter table rv_reviewers enable row level security;
alter table rv_reviews   enable row level security;

drop policy if exists "read" on rv_terms;
create policy "read" on rv_terms   for select to authenticated using (true);
drop policy if exists "read" on rv_batches;
create policy "read" on rv_batches for select to authenticated using (true);
drop policy if exists "read" on rv_results;
create policy "read" on rv_results for select to authenticated using (true);

drop policy if exists "read" on rv_reviewers;
create policy "read" on rv_reviewers for select to authenticated using (true);
drop policy if exists "own insert" on rv_reviewers;
create policy "own insert" on rv_reviewers for insert to authenticated with check (id = auth.uid());
drop policy if exists "own update" on rv_reviewers;
create policy "own update" on rv_reviewers for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- blind double review: you see your own review; you see the other reviewer's only once both are submitted
drop policy if exists "read" on rv_reviews;
create policy "read" on rv_reviews for select to authenticated
  using (reviewer_id = auth.uid() or rv_submitted_count(result_id) >= 2);
-- at most two reviews per result; a review is locked once both are submitted
drop policy if exists "own insert" on rv_reviews;
create policy "own insert" on rv_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and rv_submitted_count(result_id) < 2);
drop policy if exists "own update" on rv_reviews;
create policy "own update" on rv_reviews for update to authenticated
  using (reviewer_id = auth.uid() and rv_submitted_count(result_id) < 2)
  with check (reviewer_id = auth.uid());
