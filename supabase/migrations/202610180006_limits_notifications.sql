create or replace function public.can_add_student(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_subscriptions subscription
    join public.subscription_plans plan on plan.id = subscription.plan_id
    where subscription.school_id = target_school
      and subscription.status in ('trialing', 'active')
      and (plan.student_limit is null or (
        select count(*) from public.students student
        where student.school_id = target_school and student.is_active
      ) < plan.student_limit
      )
  );
$$;

drop policy if exists students_admin_write on public.students;
create policy students_admin_insert on public.students
  for insert to authenticated
  with check (
    public.has_school_role(school_id, array['administrator'])
    and public.can_add_student(school_id)
  );
create policy students_admin_update on public.students
  for update to authenticated
  using (public.has_school_role(school_id, array['administrator']))
  with check (public.has_school_role(school_id, array['administrator']));
create policy students_admin_delete on public.students
  for delete to authenticated
  using (public.has_school_role(school_id, array['administrator']));

create or replace function public.notify_absent_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Absent' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.notifications (school_id, user_id, title, body, related_type, related_id)
    select new.school_id, link.parent_user_id,
      'Absence recorded',
      student.full_name || ' was marked absent today.',
      'attendance',
      new.id
    from public.parent_student_links link
    join public.students student on student.id = link.student_id
    where link.student_id = new.student_id and link.verified_at is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_absence_notification on public.attendance_records;
create trigger attendance_absence_notification
after insert or update of status on public.attendance_records
for each row execute function public.notify_absent_student();

create or replace function public.notify_syllabus_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.notifications (school_id, user_id, title, body, related_type, related_id)
    select new.school_id, link.parent_user_id,
      'Syllabus updated',
      'A linked class topic is now ' || new.status || '.',
      'syllabus_topic',
      new.id
    from public.syllabus_chapters chapter
    join public.students student on student.section_id = chapter.section_id
    join public.parent_student_links link on link.student_id = student.id
    where chapter.id = new.chapter_id and link.verified_at is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists syllabus_topic_notification on public.syllabus_topics;
create trigger syllabus_topic_notification
after insert or update of status on public.syllabus_topics
for each row execute function public.notify_syllabus_update();

create or replace function public.notify_school_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.audience in ('school', 'emergency') then
    insert into public.notifications (school_id, user_id, title, body, related_type, related_id)
    select new.school_id, profile.id, new.title, new.body, 'announcement', new.id
    from public.profiles profile
    where profile.school_id = new.school_id and profile.is_active and profile.id <> new.author_id;
  end if;
  return new;
end;
$$;

drop trigger if exists announcement_notification on public.announcements;
create trigger announcement_notification
after insert on public.announcements
for each row execute function public.notify_school_announcement();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
