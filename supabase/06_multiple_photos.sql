-- =====================================================================
-- Peaches update 6: up to four photos per post.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it once, after 05_last_seen.sql.
--
-- Each post keeps a list of its photos and each photo's shape (width ÷
-- height), so a row of photos can be laid out at one height without
-- jumping around while they load. Existing single-photo posts carry over.
-- =====================================================================

alter table public.posts
  add column image_paths  text[] not null default '{}',
  add column image_ratios real[] not null default '{}';

alter table public.posts
  add constraint at_most_four_photos check (coalesce(array_length(image_paths, 1), 0) <= 4);

-- Carry existing photos over (their shape isn't known; the app measures it).
update public.posts set image_paths = array[image_path]
 where image_path is not null and image_paths = '{}';

-- A post can be photos alone.
alter table public.posts drop constraint post_not_empty;
alter table public.posts add constraint post_not_empty check (
  char_length(body) > 0 or image_path is not null
  or coalesce(array_length(image_paths, 1), 0) > 0 or link_url is not null
);

-- The post view needs rebuilding to include the new columns.
drop view public.post_details;
create view public.post_details with (security_invoker = true) as
select
  p.*,
  (select count(*) from public.hearts h where h.post_id = p.id)::int   as heart_count,
  (select count(*) from public.comments c where c.post_id = p.id)::int as comment_count,
  exists (select 1 from public.hearts h where h.post_id = p.id and h.user_id = auth.uid()) as hearted_by_me
from public.posts p;
grant select on public.post_details to authenticated;

select 'Multiple photos installed' as result;
