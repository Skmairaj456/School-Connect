create extension if not exists pgcrypto;

create table public.schools (
  id uuid primary key default gen_random_uuid(), name text not null,
  timezone text not null default 'Asia/Kolkata', created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null, phone text, is_active boolean not null default true,
  created_at timestamptz not null default now(), unique (id, school_id)
);
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  role text not null check (role in ('administrator','parent','teacher','driver')),
  created_at timestamptz not null default now(), primary key (user_id, school_id, role)
);
create table public.academic_years (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  name text not null, starts_on date not null, ends_on date not null, is_current boolean not null default false,
  check (ends_on > starts_on), unique (school_id, name)
);
create table public.classes (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id), name text not null, created_at timestamptz not null default now(),
  unique (school_id, academic_year_id, name)
);
create table public.sections (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade, name text not null, unique (class_id, name)
);
create table public.subjects (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  name text not null, unique (school_id, name)
);
create table public.teachers (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null, employee_code text, is_active boolean not null default true,
  unique (school_id, employee_code)
);
create table public.students (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  section_id uuid not null references public.sections(id), admission_number text not null, full_name text not null,
  date_of_birth date, is_active boolean not null default true, created_at timestamptz not null default now(), unique (school_id, admission_number)
);
create table public.parent_student_links (
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text not null default 'guardian', verified_at timestamptz, created_at timestamptz not null default now(),
  primary key (parent_user_id, student_id)
);
create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  subject_id uuid not null references public.subjects(id), unique (teacher_id, section_id, subject_id)
);
create table public.buses (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  bus_number text not null, registration_number text, is_active boolean not null default true, unique (school_id, bus_number)
);
create table public.drivers (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade, license_last_four text, unique (school_id, profile_id)
);
create table public.bus_routes (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  bus_id uuid not null references public.buses(id), driver_id uuid references public.drivers(id), name text not null,
  is_active boolean not null default true, unique (school_id, name)
);
create table public.bus_stops (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  route_id uuid not null references public.bus_routes(id) on delete cascade, name text not null,
  latitude double precision, longitude double precision, sequence integer not null check (sequence > 0), scheduled_time time,
  unique (route_id, sequence)
);
create table public.student_transport_assignments (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, route_id uuid not null references public.bus_routes(id),
  pickup_stop_id uuid references public.bus_stops(id), dropoff_stop_id uuid references public.bus_stops(id),
  active_from date not null default current_date, active_until date, check (active_until is null or active_until >= active_from)
);
create table public.bus_trips (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  route_id uuid not null references public.bus_routes(id), started_by uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_at timestamptz not null default now(), ended_at timestamptz, check (ended_at is null or ended_at >= started_at)
);
create table public.bus_locations (
  id bigint generated always as identity primary key, school_id uuid not null references public.schools(id) on delete cascade,
  trip_id uuid not null references public.bus_trips(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90), longitude double precision not null check (longitude between -180 and 180),
  recorded_at timestamptz not null default now(), simulated boolean not null default false
);
create table public.transport_events (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  trip_id uuid not null references public.bus_trips(id) on delete cascade, student_id uuid not null references public.students(id),
  stop_id uuid references public.bus_stops(id), event_type text not null check (event_type in ('boarded','dropped_off','incident')),
  recorded_by uuid not null references public.profiles(id), occurred_at timestamptz not null default now(), notes text
);
create table public.syllabus_chapters (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  section_id uuid not null references public.sections(id), subject_id uuid not null references public.subjects(id),
  title text not null, planned_start date, planned_end date, unique (section_id, subject_id, title)
);
create table public.syllabus_topics (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  chapter_id uuid not null references public.syllabus_chapters(id) on delete cascade, title text not null,
  status text not null default 'Not Started' check (status in ('Not Started','In Progress','Completed')),
  planned_start date, completed_at timestamptz, resource_url text, updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table public.teaching_logs (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id), section_id uuid not null references public.sections(id),
  subject_id uuid not null references public.subjects(id), topic_id uuid references public.syllabus_topics(id),
  taught_on date not null default current_date, notes text not null, created_at timestamptz not null default now()
);
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, attendance_date date not null,
  status text not null check (status in ('Present','Absent','Late','Excused')), check_in_at timestamptz,
  recorded_by uuid not null references public.profiles(id), updated_at timestamptz not null default now(), unique (student_id, attendance_date)
);
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, requested_by uuid not null references public.profiles(id),
  starts_on date not null, ends_on date not null, reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, check (ends_on >= starts_on)
);
create table public.homework (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  section_id uuid not null references public.sections(id), subject_id uuid not null references public.subjects(id),
  teacher_id uuid not null references public.teachers(id), title text not null, description text not null,
  due_at timestamptz not null, resource_url text, created_at timestamptz not null default now()
);
create table public.exams (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  section_id uuid not null references public.sections(id), subject_id uuid not null references public.subjects(id),
  title text not null, starts_at timestamptz not null, max_marks numeric(7,2) not null check (max_marks > 0)
);
create table public.marks (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade, student_id uuid not null references public.students(id) on delete cascade,
  score numeric(7,2) not null check (score >= 0), feedback text, entered_by uuid not null references public.profiles(id), unique (exam_id, student_id)
);
create table public.announcements (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  author_id uuid not null references public.profiles(id), title text not null, body text not null,
  audience text not null default 'school' check (audience in ('school','class','route','emergency')),
  section_id uuid references public.sections(id), route_id uuid references public.bus_routes(id), published_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, title text not null, body text not null,
  related_type text, related_id uuid, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.school_events (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  title text not null, event_type text not null, starts_at timestamptz not null, ends_at timestamptz, description text
);
create table public.fee_records (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, label text not null,
  amount numeric(10,2) not null check (amount >= 0), due_on date not null, status text not null default 'due' check (status in ('due','paid','waived'))
);
create table public.pickup_contacts (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, full_name text not null,
  relationship text not null, phone text not null, authorized boolean not null default false
);
create table public.incident_reports (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  trip_id uuid references public.bus_trips(id), student_id uuid references public.students(id),
  reported_by uuid not null references public.profiles(id), category text not null, description text not null,
  status text not null default 'open' check (status in ('open','investigating','resolved')),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.audit_logs (
  id bigint generated always as identity primary key, school_id uuid not null references public.schools(id) on delete cascade,
  actor_id uuid references public.profiles(id), action text not null, record_type text not null, record_id uuid,
  occurred_at timestamptz not null default now(), details jsonb not null default '{}'::jsonb
);

create index students_school_section_idx on public.students (school_id, section_id, full_name);
create index attendance_school_day_idx on public.attendance_records (school_id, attendance_date desc);
create index bus_locations_trip_time_idx on public.bus_locations (trip_id, recorded_at desc);
create index announcements_school_time_idx on public.announcements (school_id, published_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, read_at, created_at desc);