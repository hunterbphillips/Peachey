-- =====================================================================
-- Peaches update 3: hearts on comments.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it once, after 02_friends.sql.
--
-- Same rules as hearts on posts: you can heart any comment on a post
-- you can see, and only remove your own hearts.
-- =====================================================================

create table public.comment_hearts (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_hearts_user on public.comment_hearts (user_id);

-- Can I see this comment? (Only if I can see the post it's on.)
create function public.can_see_comment(comment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from comments c where c.id = comment and public.can_see_post(c.post_id));
$$;
revoke execute on function public.can_see_comment(uuid) from public, anon;
grant execute on function public.can_see_comment(uuid) to authenticated;

alter table public.comment_hearts enable row level security;
create policy "read hearts on comments you can see" on public.comment_hearts
  for select to authenticated using (public.can_see_comment(comment_id));
create policy "heart comments you can see" on public.comment_hearts
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_comment(comment_id));
create policy "unheart your own" on public.comment_hearts
  for delete to authenticated using (user_id = auth.uid());

select 'Comment hearts installed' as result;
