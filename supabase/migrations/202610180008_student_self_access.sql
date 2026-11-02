create or replace function public.can_access_student(target_student uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = target_student and (
      s.user_id = auth.uid()
      or public.has_school_role(s.school_id, array['administrator'])
      or exists (select 1 from public.parent_student_links l where l.student_id = s.id and l.parent_user_id = auth.uid() and l.verified_at is not null)
      or exists (select 1 from public.teacher_assignments a join public.teachers t on t.id = a.teacher_id where a.section_id = s.section_id and t.profile_id = auth.uid())
    )
  )
$$;
