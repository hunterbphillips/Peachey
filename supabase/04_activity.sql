-- =====================================================================
-- Peachey update 4: the Activity screen.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it once, after 03_comment_hearts.sql.
--
-- Activity is worked out from what's already stored (hearts, comments,
-- friendships), so nothing new is recorded. The only new piece is when
-- each person last opened Activity, which drives the bell's count.
-- =====================================================================

alter table public.profiles
  add column activity_seen_at timestamptz not null default now();

-- Everything that happened to me, newest first (up to 60 items).
--   heart_post      someone hearted my post
--   comment         someone commented on my post
--   heart_comment   someone hearted my comment
--   thread_comment  someone commented on a post I've commented on (not mine)
--   friend_request  someone wants to be friends
--   friend_accepted someone accepted my request
--   joined          someone joined with my invite code (and is now my friend)
create function public.my_activity()
returns table (
  kind text, actor_id uuid, actor_name text, actor_avatar_path text,
  post_id uuid, post_author_id uuid, post_author_name text,
  snippet text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id where public.is_member()),
  items as (
    -- hearts on my posts
    select 'heart_post' as kind, h.user_id as actor_id, p.id as post_id, p.author_id as post_author_id,
           coalesce(nullif(p.body, ''), case when p.image_path is not null then 'your photo' else p.link_url end) as snippet,
           h.created_at
      from hearts h join posts p on p.id = h.post_id, me
     where p.author_id = me.id and h.user_id <> me.id
    union all
    -- comments on my posts
    select 'comment', c.author_id, p.id, p.author_id, c.body, c.created_at
      from comments c join posts p on p.id = c.post_id, me
     where p.author_id = me.id and c.author_id <> me.id
    union all
    -- hearts on my comments (only where I can still see the post)
    select 'heart_comment', ch.user_id, c.post_id, p.author_id, c.body, ch.created_at
      from comment_hearts ch join comments c on c.id = ch.comment_id join posts p on p.id = c.post_id, me
     where c.author_id = me.id and ch.user_id <> me.id and public.can_see_post(p.id)
    union all
    -- later comments on others' posts I've joined in on
    select 'thread_comment', c.author_id, p.id, p.author_id, c.body, c.created_at
      from comments c join posts p on p.id = c.post_id, me
     where p.author_id <> me.id and c.author_id <> me.id
       and public.can_see_post(p.id)
       and c.created_at > (select min(mine.created_at) from comments mine
                            where mine.post_id = p.id and mine.author_id = me.id)
    union all
    -- friend requests waiting for me
    select 'friend_request', f.requester_id, null, null, null, f.created_at
      from friendships f, me
     where f.addressee_id = me.id and f.status = 'pending'
    union all
    -- my requests that were accepted, and people who joined with my code
    select case when exists (select 1 from invite_codes ic
                              where ic.created_by = f.requester_id and ic.used_by = f.addressee_id)
                then 'joined' else 'friend_accepted' end,
           f.addressee_id, null, null, null, f.accepted_at
      from friendships f, me
     where f.requester_id = me.id and f.status = 'accepted' and f.accepted_at is not null
  )
  select i.kind, i.actor_id, a.display_name, a.avatar_path,
         i.post_id, i.post_author_id, pa.display_name,
         left(i.snippet, 140), i.created_at
    from items i
    join profiles a on a.id = i.actor_id
    left join profiles pa on pa.id = i.post_author_id
   order by i.created_at desc
   limit 60;
$$;

-- How many activity items are newer than when I last looked.
create function public.activity_unread() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.my_activity() a
   where a.created_at > (select activity_seen_at from profiles where id = auth.uid());
$$;

-- I've just looked at Activity. Returns when I'd previously looked,
-- so the screen can still highlight what was new this time.
create function public.mark_activity_seen() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  previous timestamptz;
begin
  select activity_seen_at into previous from profiles where id = auth.uid();
  update profiles set activity_seen_at = now() where id = auth.uid();
  return previous;
end;
$$;

revoke execute on function public.my_activity() from public, anon;
revoke execute on function public.activity_unread() from public, anon;
revoke execute on function public.mark_activity_seen() from public, anon;
grant execute on function public.my_activity() to authenticated;
grant execute on function public.activity_unread() to authenticated;
grant execute on function public.mark_activity_seen() to authenticated;

select 'Activity installed' as result;
