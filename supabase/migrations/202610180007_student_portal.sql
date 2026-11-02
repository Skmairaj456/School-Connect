alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role in ('platform_admin','administrator','parent','teacher','driver','student'));

alter table public.students add column if not exists user_id uuid unique references public.profiles(id) on delete set null;
alter table public.exams add column if not exists published_at timestamptz;

create table if not exists public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  teacher_id uuid references public.teachers(id),
  day_of_week smallint not null check (day_of_week between 1 and 7),
  period_number smallint not null check (period_number > 0),
  starts_at time not null,
  ends_at time not null,
  room text,
  is_break boolean not null default false,
  unique (section_id, day_of_week, period_number),
  check (ends_at > starts_at)
);

create index if not exists timetable_section_day_idx on public.timetable_periods (school_id, section_id, day_of_week, period_number);
alter table public.timetable_periods enable row level security;

alter table public.students add constraint students_user_same_school
  foreign key (user_id, school_id) references public.profiles(id, school_id);

create or replace function public.can_access_section(target_section uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.sections sec
    where sec.id = target_section and (
      public.has_school_role(sec.school_id, array['administrator'])
      or exists (select 1 from public.students s join public.parent_student_links l on l.student_id = s.id where s.section_id = sec.id and l.parent_user_id = auth.uid() and l.verified_at is not null)
      or exists (select 1 from public.students s where s.section_id = sec.id and s.user_id = auth.uid())
      or exists (select 1 from public.teacher_assignments a join public.teachers t on t.id = a.teacher_id where a.section_id = sec.id and t.profile_id = auth.uid())
    )
  )
$$;

create or replace function public.can_access_course(target_section uuid, target_subject uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.sections sec where sec.id = target_section and (
      public.has_school_role(sec.school_id, array['administrator'])
      or exists (select 1 from public.students s join public.parent_student_links l on l.student_id = s.id where s.section_id = sec.id and l.parent_user_id = auth.uid() and l.verified_at is not null)
      or exists (select 1 from public.students s where s.section_id = sec.id and s.user_id = auth.uid())
      or exists (select 1 from public.teacher_assignments a join public.teachers t on t.id = a.teacher_id where a.section_id = sec.id and a.subject_id = target_subject and t.profile_id = auth.uid())
    )
  )
$$;

create policy timetable_scoped_read on public.timetable_periods
  for select to authenticated using (public.can_access_section(section_id));
create policy timetable_admin_write on public.timetable_periods
  for all to authenticated using (public.has_school_role(school_id, array['administrator']))
  with check (public.has_school_role(school_id, array['administrator']));

drop policy if exists marks_scoped_read on public.marks;
create policy marks_scoped_read on public.marks
  for select to authenticated using (
    public.can_access_student(student_id)
    and (
      not public.has_school_role(school_id, array['student'])
      or exists (select 1 from public.exams e where e.id = exam_id and e.published_at is not null)
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'timetable_periods'
  ) then
    alter publication supabase_realtime add table public.timetable_periods;
  end if;
end $$;
