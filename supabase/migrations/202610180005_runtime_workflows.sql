alter table public.bus_trips add column if not exists simulated boolean not null default false;

create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  homework_id uuid not null references public.homework(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','reviewed','returned')),
  submitted_at timestamptz not null default now(),
  unique (homework_id, submitted_by)
);

create index if not exists homework_submissions_user_idx
  on public.homework_submissions (school_id, submitted_by, submitted_at desc);

alter table public.homework_submissions enable row level security;

create policy homework_submissions_read on public.homework_submissions
  for select to authenticated using (
    submitted_by = auth.uid()
    or public.has_school_role(school_id, array['administrator','teacher'])
  );

create policy homework_submissions_insert on public.homework_submissions
  for insert to authenticated with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.homework h
      where h.id = homework_id
        and h.school_id = homework_submissions.school_id
        and public.can_access_section(h.section_id)
    )
  );

create policy homework_submissions_update on public.homework_submissions
  for update to authenticated using (
    submitted_by = auth.uid()
    or public.has_school_role(school_id, array['administrator','teacher'])
  ) with check (
    submitted_by = auth.uid()
    or public.has_school_role(school_id, array['administrator','teacher'])
  );

drop policy if exists locations_driver_insert on public.bus_locations;
create policy locations_driver_insert on public.bus_locations
  for insert to authenticated with check (
    exists (
      select 1
      from public.bus_trips t
      join public.bus_routes r on r.id = t.route_id and r.school_id = t.school_id
      join public.drivers d on d.id = r.driver_id and d.school_id = t.school_id
      where t.id = trip_id
        and t.school_id = bus_locations.school_id
        and t.status = 'active'
        and d.profile_id = auth.uid()
    )
  );

drop policy if exists trips_driver_insert on public.bus_trips;
create policy trips_driver_insert on public.bus_trips
  for insert to authenticated with check (
    started_by = auth.uid()
    and status = 'active'
    and exists (
      select 1
      from public.bus_routes r
      join public.drivers d on d.id = r.driver_id and d.school_id = r.school_id
      where r.id = route_id
        and r.school_id = bus_trips.school_id
        and d.profile_id = auth.uid()
    )
  );

drop policy if exists schools_member_read on public.schools;
create policy schools_member_read on public.schools
  for select to authenticated using (
    public.is_school_member(id)
    or exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role = 'platform_admin'
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bus_locations'
  ) then
    alter publication supabase_realtime add table public.bus_locations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bus_trips'
  ) then
    alter publication supabase_realtime add table public.bus_trips;
  end if;
end $$;
