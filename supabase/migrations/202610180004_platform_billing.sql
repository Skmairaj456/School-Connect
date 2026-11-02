alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role in ('platform_admin','administrator','parent','teacher','driver'));

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  monthly_amount_inr integer not null check (monthly_amount_inr >= 0),
  student_limit integer check (student_limit is null or student_limit > 0),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.school_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','paused','cancelled')),
  starts_on date not null default current_date,
  renews_on date,
  created_at timestamptz not null default now(),
  unique (school_id)
);

create index school_subscriptions_plan_idx on public.school_subscriptions (plan_id, status);
alter table public.subscription_plans enable row level security;
alter table public.school_subscriptions enable row level security;
create policy plans_platform_read on public.subscription_plans for select to authenticated using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'platform_admin'));
create policy plans_member_read on public.subscription_plans for select to authenticated using (exists (select 1 from public.school_subscriptions s where s.plan_id = id and public.is_school_member(s.school_id)));
create policy plans_platform_write on public.subscription_plans for all to authenticated using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'platform_admin')) with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'platform_admin'));
create policy subscriptions_platform_read on public.school_subscriptions for select to authenticated using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'platform_admin'));
create policy subscriptions_member_read on public.school_subscriptions for select to authenticated using (public.is_school_member(school_id));
create policy subscriptions_platform_write on public.school_subscriptions for all to authenticated using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'platform_admin')) with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'platform_admin'));
