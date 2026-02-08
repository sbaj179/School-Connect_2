create extension if not exists "pgcrypto";

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_code text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.normalize_school_code()
returns trigger
language plpgsql
as $$
begin
  new.school_code := upper(new.school_code);
  return new;
end;
$$;

create trigger schools_normalize_code
before insert or update on public.schools
for each row execute function public.normalize_school_code();

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  auth_user_id uuid unique null references auth.users(id) on delete set null,
  role text not null check (role in ('student','parent','teacher','admin')),
  name text not null,
  email text null,
  external_id text null,
  parent_platform_id text null,
  class_name text null,
  created_at timestamptz not null default now()
);

create unique index if not exists users_student_unique
  on public.users(school_id, external_id)
  where role = 'student' and external_id is not null;

create unique index if not exists users_parent_unique
  on public.users(school_id, email)
  where role = 'parent' and email is not null;

create unique index if not exists users_teacher_unique
  on public.users(school_id, email)
  where role = 'teacher' and email is not null;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  type text not null default 'thread',
  subject text not null,
  student_external_id text null,
  created_by uuid null references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists groups_school_id_idx on public.groups(school_id);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists group_members_unique
  on public.group_members(group_id, user_id);

create index if not exists group_members_user_id_idx
  on public.group_members(user_id);

create index if not exists group_members_group_id_idx
  on public.group_members(group_id);

create index if not exists group_members_school_id_idx
  on public.group_members(school_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_user_id uuid not null references public.users(id),
  body text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_group_created_idx
  on public.messages(group_id, created_at desc);

create index if not exists messages_school_id_idx
  on public.messages(school_id);

create or replace function public.set_message_school_id()
returns trigger
language plpgsql
as $$
declare
  v_school_id uuid;
begin
  select school_id into v_school_id from public.groups where id = new.group_id;
  if v_school_id is null then
    raise exception 'Group not found for message';
  end if;

  if new.school_id is null then
    new.school_id := v_school_id;
  elsif new.school_id <> v_school_id then
    raise exception 'Message school_id does not match group school_id';
  end if;

  return new;
end;
$$;

create trigger messages_set_school_id
before insert on public.messages
for each row execute function public.set_message_school_id();

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  starts_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.automated_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid();
$$;

create or replace function public.current_user_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.users where auth_user_id = auth.uid();
$$;

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.automated_messages enable row level security;

create policy users_select_same_school
  on public.users
  for select
  using (school_id = public.current_user_school_id());

create policy users_update_own
  on public.users
  for update
  using (id = public.current_user_profile_id())
  with check (id = public.current_user_profile_id());

create policy groups_select_member
  on public.groups
  for select
  using (
    school_id = public.current_user_school_id()
    and exists (
      select 1
      from public.group_members gm
      where gm.group_id = groups.id
        and gm.user_id = public.current_user_profile_id()
    )
  );

create policy groups_insert_own
  on public.groups
  for insert
  with check (
    school_id = public.current_user_school_id()
    and created_by = public.current_user_profile_id()
  );

create policy group_members_select_own
  on public.group_members
  for select
  using (
    school_id = public.current_user_school_id()
    and user_id = public.current_user_profile_id()
  );

create policy messages_select_member
  on public.messages
  for select
  using (
    school_id = public.current_user_school_id()
    and exists (
      select 1
      from public.group_members gm
      where gm.group_id = messages.group_id
        and gm.user_id = public.current_user_profile_id()
    )
  );

create policy messages_insert_member
  on public.messages
  for insert
  with check (
    school_id = public.current_user_school_id()
    and sender_user_id = public.current_user_profile_id()
    and exists (
      select 1
      from public.group_members gm
      where gm.group_id = messages.group_id
        and gm.user_id = public.current_user_profile_id()
    )
  );

create policy events_select_same_school
  on public.events
  for select
  using (school_id = public.current_user_school_id());

create policy automated_messages_select_same_school
  on public.automated_messages
  for select
  using (school_id = public.current_user_school_id());
