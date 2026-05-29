create extension if not exists "pgcrypto";

create table if not exists expenses (
  id            uuid primary key default gen_random_uuid(),
  amount        decimal(10,2) not null,
  description   text not null,
  category      text not null default 'other',
  date          date not null,
  paid_by       text not null,
  split         text not null default 'even',
  note          text,
  created_at    timestamptz default now()
);

create table if not exists income (
  id         uuid primary key default gen_random_uuid(),
  amount     decimal(10,2) not null,
  source     text not null,
  type       text not null default 'other',
  owner      text not null,
  date       date not null,
  recurring  boolean default false,
  created_at timestamptz default now()
);

create table if not exists budgets (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  monthly_limit decimal(10,2) not null,
  owner         text not null default 'shared',
  month         integer not null,
  year          integer not null,
  created_at    timestamptz default now(),
  unique(category, owner, month, year)
);

create table if not exists goals (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  target_amount  decimal(10,2) not null,
  current_amount decimal(10,2) default 0,
  deadline       date,
  owner          text not null default 'both',
  color          text,
  created_at     timestamptz default now()
);

alter table expenses enable row level security;
alter table income   enable row level security;
alter table budgets  enable row level security;
alter table goals    enable row level security;

drop policy if exists "authenticated full access" on expenses;
drop policy if exists "authenticated full access" on income;
drop policy if exists "authenticated full access" on budgets;
drop policy if exists "authenticated full access" on goals;

create policy "authenticated full access" on expenses for all to authenticated using (true) with check (true);
create policy "authenticated full access" on income   for all to authenticated using (true) with check (true);
create policy "authenticated full access" on budgets  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on goals    for all to authenticated using (true) with check (true);
