create or replace function public.has_school_role(target_school uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id and p.school_id = r.school_id where r.user_id = auth.uid() and r.school_id = target_school and p.is_active and r.role = any(allowed_roles)) $$;

create or replace function public.is_school_member(target_school uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = target_school and p.is_active) $$;

create or replace function public.current_user_school()
returns uuid language sql stable security definer set search_path = public set row_security = off
as $$ select p.school_id from public.profiles p where p.id = auth.uid() $$;

create or replace function public.can_access_student(target_student uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = target_student and (
      public.has_school_role(s.school_id, array['administrator'])
      or exists (select 1 from public.parent_student_links l where l.student_id = s.id and l.parent_user_id = auth.uid() and l.verified_at is not null)
      or exists (select 1 from public.teacher_assignments a join public.teachers t on t.id = a.teacher_id where a.section_id = s.section_id and t.profile_id = auth.uid())
    )
  )
$$;

create or replace function public.can_access_section(target_section uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.sections sec join public.classes c on c.id = sec.class_id
    where sec.id = target_section and (
      public.has_school_role(sec.school_id, array['administrator'])
      or exists (select 1 from public.students s join public.parent_student_links l on l.student_id = s.id where s.section_id = sec.id and l.parent_user_id = auth.uid() and l.verified_at is not null)
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
      or exists (select 1 from public.teacher_assignments a join public.teachers t on t.id = a.teacher_id where a.section_id = sec.id and a.subject_id = target_subject and t.profile_id = auth.uid())
    )
  )
$$;

create or replace function public.can_access_route(target_route uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.bus_routes r where r.id = target_route and (
      public.has_school_role(r.school_id, array['administrator'])
      or exists (select 1 from public.drivers d where d.id = r.driver_id and d.profile_id = auth.uid())
      or exists (select 1 from public.student_transport_assignments a join public.parent_student_links l on l.student_id = a.student_id where a.route_id = r.id and a.active_until is null and l.parent_user_id = auth.uid() and l.verified_at is not null)
    )
  )
$$;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.subjects enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.students enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.buses enable row level security;
alter table public.drivers enable row level security;
alter table public.bus_routes enable row level security;
alter table public.bus_stops enable row level security;
alter table public.student_transport_assignments enable row level security;
alter table public.bus_trips enable row level security;
alter table public.bus_locations enable row level security;
alter table public.transport_events enable row level security;
alter table public.syllabus_chapters enable row level security;
alter table public.syllabus_topics enable row level security;
alter table public.teaching_logs enable row level security;
alter table public.attendance_records enable row level security;
alter table public.leave_requests enable row level security;
alter table public.homework enable row level security;
alter table public.exams enable row level security;
alter table public.marks enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.school_events enable row level security;
alter table public.fee_records enable row level security;
alter table public.pickup_contacts enable row level security;
alter table public.incident_reports enable row level security;
alter table public.audit_logs enable row level security;

create policy schools_member_read on public.schools for select to authenticated using (public.is_school_member(id));
create policy profiles_self_or_admin_read on public.profiles for select to authenticated using (id = auth.uid() or public.has_school_role(school_id, array['administrator']));
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and school_id = public.current_user_school());
create policy roles_self_or_admin_read on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_school_role(school_id, array['administrator']));
create policy roles_admin_write on public.user_roles for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));

create policy academic_years_member_read on public.academic_years for select to authenticated using (public.is_school_member(school_id));
create policy academic_years_admin_write on public.academic_years for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy classes_member_read on public.classes for select to authenticated using (public.is_school_member(school_id));
create policy classes_admin_write on public.classes for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy sections_member_read on public.sections for select to authenticated using (public.is_school_member(school_id));
create policy sections_admin_write on public.sections for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy subjects_member_read on public.subjects for select to authenticated using (public.is_school_member(school_id));
create policy subjects_admin_write on public.subjects for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy teachers_self_or_admin_read on public.teachers for select to authenticated using (public.is_school_member(school_id) and (profile_id = auth.uid() or public.has_school_role(school_id, array['administrator','teacher'])));
create policy teachers_admin_write on public.teachers for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy teacher_assignments_scoped_read on public.teacher_assignments for select to authenticated using (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.teachers t where t.id = teacher_id and t.profile_id = auth.uid()));
create policy teacher_assignments_admin_write on public.teacher_assignments for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy students_scoped_read on public.students for select to authenticated using (public.can_access_student(id));
create policy students_admin_write on public.students for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy links_self_or_admin_read on public.parent_student_links for select to authenticated using (parent_user_id = auth.uid() or public.has_school_role(school_id, array['administrator']));
create policy links_admin_write on public.parent_student_links for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));

create policy buses_route_read on public.buses for select to authenticated using (public.is_school_member(school_id) and (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.bus_routes r where r.bus_id = buses.id and public.can_access_route(r.id))));
create policy buses_admin_write on public.buses for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy drivers_self_or_admin_read on public.drivers for select to authenticated using (profile_id = auth.uid() or public.has_school_role(school_id, array['administrator']));
create policy drivers_admin_write on public.drivers for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy routes_assigned_read on public.bus_routes for select to authenticated using (public.can_access_route(id));
create policy routes_admin_write on public.bus_routes for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy stops_assigned_read on public.bus_stops for select to authenticated using (public.can_access_route(route_id));
create policy stops_admin_write on public.bus_stops for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy transport_assignments_scoped_read on public.student_transport_assignments for select to authenticated using (public.can_access_student(student_id) or public.can_access_route(route_id));
create policy transport_assignments_admin_write on public.student_transport_assignments for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy trips_assigned_read on public.bus_trips for select to authenticated using (public.can_access_route(route_id));
create policy trips_driver_insert on public.bus_trips for insert to authenticated with check (started_by = auth.uid() and status = 'active' and exists (select 1 from public.bus_routes r join public.drivers d on d.id = r.driver_id where r.id = route_id and d.profile_id = auth.uid()));
create policy trips_driver_end on public.bus_trips for update to authenticated using (started_by = auth.uid() and status = 'active' and exists (select 1 from public.bus_routes r join public.drivers d on d.id = r.driver_id where r.id = bus_trips.route_id and d.profile_id = auth.uid())) with check (started_by = auth.uid() and status in ('active','completed','cancelled') and exists (select 1 from public.bus_routes r join public.drivers d on d.id = r.driver_id where r.id = bus_trips.route_id and r.school_id = bus_trips.school_id and d.profile_id = auth.uid()));
create policy locations_active_assigned_read on public.bus_locations for select to authenticated using (exists (select 1 from public.bus_trips t where t.id = trip_id and t.status = 'active' and public.can_access_route(t.route_id)));
create policy locations_driver_insert on public.bus_locations for insert to authenticated with check (exists (select 1 from public.bus_trips t join public.bus_routes r on r.id = t.route_id join public.drivers d on d.id = r.driver_id where t.id = trip_id and t.status = 'active' and d.profile_id = auth.uid()));
create policy transport_events_assigned_read on public.transport_events for select to authenticated using (public.can_access_student(student_id) or exists (select 1 from public.bus_trips t where t.id = trip_id and public.can_access_route(t.route_id)));
create policy transport_events_driver_insert on public.transport_events for insert to authenticated with check (recorded_by = auth.uid() and exists (select 1 from public.bus_trips t join public.bus_routes r on r.id = t.route_id join public.drivers d on d.id = r.driver_id where t.id = trip_id and t.status = 'active' and d.profile_id = auth.uid()));

create policy syllabus_chapters_member_read on public.syllabus_chapters for select to authenticated using (public.can_access_course(section_id, subject_id));
create policy syllabus_chapters_admin_write on public.syllabus_chapters for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy syllabus_topics_member_read on public.syllabus_topics for select to authenticated using (exists (select 1 from public.syllabus_chapters c where c.id = syllabus_topics.chapter_id and public.can_access_course(c.section_id, c.subject_id)));
create policy syllabus_topics_staff_write on public.syllabus_topics for all to authenticated using (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.syllabus_chapters c join public.teacher_assignments a on a.section_id = c.section_id and a.subject_id = c.subject_id join public.teachers t on t.id = a.teacher_id where c.id = chapter_id and t.profile_id = auth.uid())) with check (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.syllabus_chapters c join public.teacher_assignments a on a.section_id = c.section_id and a.subject_id = c.subject_id join public.teachers t on t.id = a.teacher_id where c.id = chapter_id and t.profile_id = auth.uid()));
create policy teaching_logs_member_read on public.teaching_logs for select to authenticated using (public.can_access_course(section_id, subject_id));
create policy teaching_logs_staff_write on public.teaching_logs for all to authenticated using (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.teachers t join public.teacher_assignments a on a.teacher_id = t.id where t.id = teaching_logs.teacher_id and t.profile_id = auth.uid() and a.section_id = teaching_logs.section_id and a.subject_id = teaching_logs.subject_id)) with check (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.teachers t join public.teacher_assignments a on a.teacher_id = t.id where t.id = teaching_logs.teacher_id and t.profile_id = auth.uid() and a.section_id = teaching_logs.section_id and a.subject_id = teaching_logs.subject_id));
create policy attendance_scoped_read on public.attendance_records for select to authenticated using (public.can_access_student(student_id));
create policy attendance_staff_write on public.attendance_records for all to authenticated using (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.students s join public.teacher_assignments a on a.section_id = s.section_id join public.teachers t on t.id = a.teacher_id where s.id = student_id and t.profile_id = auth.uid())) with check (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.students s join public.teacher_assignments a on a.section_id = s.section_id join public.teachers t on t.id = a.teacher_id where s.id = student_id and t.profile_id = auth.uid()));
create policy leaves_scoped_read on public.leave_requests for select to authenticated using (requested_by = auth.uid() or public.can_access_student(student_id));
create policy leaves_parent_insert on public.leave_requests for insert to authenticated with check (requested_by = auth.uid() and public.has_school_role(school_id, array['parent']) and public.can_access_student(student_id));
create policy leaves_staff_update on public.leave_requests for update to authenticated using (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.students s join public.teacher_assignments a on a.section_id = s.section_id join public.teachers t on t.id = a.teacher_id where s.id = leave_requests.student_id and t.profile_id = auth.uid())) with check (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.students s join public.teacher_assignments a on a.section_id = s.section_id join public.teachers t on t.id = a.teacher_id where s.id = leave_requests.student_id and t.profile_id = auth.uid()));

create policy homework_assigned_read on public.homework for select to authenticated using (public.can_access_course(section_id, subject_id));
create policy homework_staff_write on public.homework for all to authenticated using (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.teachers t join public.teacher_assignments a on a.teacher_id = t.id where t.id = homework.teacher_id and t.profile_id = auth.uid() and a.section_id = homework.section_id and a.subject_id = homework.subject_id)) with check (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.teachers t join public.teacher_assignments a on a.teacher_id = t.id where t.id = homework.teacher_id and t.profile_id = auth.uid() and a.section_id = homework.section_id and a.subject_id = homework.subject_id));
create policy exams_assigned_read on public.exams for select to authenticated using (public.can_access_course(section_id, subject_id));
create policy exams_staff_write on public.exams for all to authenticated using (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.teacher_assignments a join public.teachers t on t.id = a.teacher_id where a.section_id = exams.section_id and a.subject_id = exams.subject_id and t.profile_id = auth.uid())) with check (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.teacher_assignments a join public.teachers t on t.id = a.teacher_id where a.section_id = exams.section_id and a.subject_id = exams.subject_id and t.profile_id = auth.uid()));
create policy marks_scoped_read on public.marks for select to authenticated using (public.can_access_student(student_id));
create policy marks_staff_write on public.marks for all to authenticated using (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.exams e join public.teacher_assignments a on a.section_id = e.section_id and a.subject_id = e.subject_id join public.teachers t on t.id = a.teacher_id where e.id = marks.exam_id and t.profile_id = auth.uid())) with check (public.has_school_role(school_id, array['administrator']) or exists (select 1 from public.exams e join public.teacher_assignments a on a.section_id = e.section_id and a.subject_id = e.subject_id join public.teachers t on t.id = a.teacher_id where e.id = marks.exam_id and t.profile_id = auth.uid()));
create policy announcements_targeted_read on public.announcements for select to authenticated using (public.is_school_member(school_id) and (audience in ('school','emergency') or (section_id is not null and public.can_access_section(section_id)) or (route_id is not null and public.can_access_route(route_id))));
create policy announcements_staff_write on public.announcements for all to authenticated using (public.has_school_role(school_id, array['administrator','teacher'])) with check (public.has_school_role(school_id, array['administrator','teacher']) and author_id = auth.uid());
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy events_member_read on public.school_events for select to authenticated using (public.is_school_member(school_id));
create policy events_admin_write on public.school_events for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy fees_student_read on public.fee_records for select to authenticated using (public.can_access_student(student_id));
create policy fees_admin_write on public.fee_records for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy pickup_contacts_scoped_read on public.pickup_contacts for select to authenticated using (public.has_school_role(school_id, array['administrator']) or public.can_access_student(pickup_contacts.student_id) or exists (select 1 from public.student_transport_assignments a join public.bus_routes r on r.id = a.route_id join public.drivers d on d.id = r.driver_id where a.student_id = pickup_contacts.student_id and d.profile_id = auth.uid() and a.active_until is null and pickup_contacts.authorized));
create policy pickup_contacts_admin_write on public.pickup_contacts for all to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy incidents_scoped_read on public.incident_reports for select to authenticated using (public.has_school_role(school_id, array['administrator']) or (student_id is not null and public.can_access_student(student_id)) or (trip_id is not null and exists (select 1 from public.bus_trips t where t.id = trip_id and public.can_access_route(t.route_id))));
create policy incidents_staff_insert on public.incident_reports for insert to authenticated with check (reported_by = auth.uid() and public.has_school_role(school_id, array['administrator','driver']));
create policy incidents_admin_update on public.incident_reports for update to authenticated using (public.has_school_role(school_id, array['administrator'])) with check (public.has_school_role(school_id, array['administrator']));
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.has_school_role(school_id, array['administrator']));