import { groupActivity } from '../lib/activity.js';
import { createClient } from '@supabase/supabase-js';
import { compressImage, compressPhoto } from '../lib/image.js';

export function makeSupabaseApi(url, anonKey) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  // ---- photo links (the bucket is private, so we use short-lived signed links)
  const urlCache = new Map(); // path -> { url, expires }
  async function resolvePaths(paths) {
    const now = Date.now();
    const need = [...new Set(paths.filter(Boolean))].filter((p) => {
      const c = urlCache.get(p);
      return !c || c.expires < now + 60_000;
    });
    if (need.length) {
      const { data, error } = await sb.storage.from('photos').createSignedUrls(need, 3600);
      if (!error) {
        for (const item of data) {
          if (item.signedUrl) urlCache.set(item.path, { url: item.signedUrl, expires: now + 3600_000 });
        }
      }
    }
    return (p) => (p ? urlCache.get(p)?.url ?? null : null);
  }

  async function withUrls(rows, fields) {
    const get = await resolvePaths(rows.flatMap((r) => fields.map(([from]) => r[from])));
    return rows.map((r) => {
      const out = { ...r };
      for (const [from, to] of fields) out[to] = get(r[from]);
      return out;
    });
  }

  async function uid() {
    const { data } = await sb.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  async function upload(folder, blob) {
    const me = await uid();
    const path = `${me}/${folder}/${crypto.randomUUID()}.jpg`;
    check(await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' }));
    return path;
  }

  const PAGE = 20;

  return {
    isDemo: false,

    // ---- auth
    async getUserId() { return uid(); },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user?.id ?? null));
      return () => data.subscription.unsubscribe();
    },
    async sendCode(email) {
      check(await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      }));
    },
    async verifyCode(email, token) {
      check(await sb.auth.verifyOtp({ email, token, type: 'email' }));
    },
    async signOut() { await sb.auth.signOut(); },

    // ---- me & profiles
    async getMe() {
      const me = await uid();
      if (!me) return null;
      const rows = check(await sb.from('profiles').select('*').eq('id', me));
      if (!rows.length) return null;
      return (await withUrls(rows, [['avatar_path', 'avatar_url']]))[0];
    },
    async redeemInvite(code, name) {
      check(await sb.rpc('redeem_invite', { invite_code: code, name }));
    },
    async getProfile(id) {
      const rows = check(await sb.from('profiles').select('id, display_name, avatar_path').eq('id', id));
      if (!rows.length) return null;
      return (await withUrls(rows, [['avatar_path', 'avatar_url']]))[0];
    },
    async updateProfile({ display_name, show_last_seen, avatarFile }) {
      const me = await uid();
      const patch = { display_name };
      if (typeof show_last_seen === 'boolean') patch.show_last_seen = show_last_seen;
      if (avatarFile) {
        const blob = await compressImage(avatarFile, { maxSize: 480, square: true });
        patch.avatar_path = await upload('avatar', blob);
      }
      const { error } = await sb.from('profiles').update(patch).eq('id', me);
      if (error && /show_last_seen/.test(error.message)) {
        // The last-seen update (05) hasn't been run yet: save everything else.
        delete patch.show_last_seen;
        check(await sb.from('profiles').update(patch).eq('id', me));
      } else if (error) {
        throw new Error(error.message);
      }
    },

    // ---- reports and looking after the group
    async reportPost(postId, note) {
      check(await sb.rpc('report_post', { post: postId, note: note || '' }));
    },
    async adminReports() {
      return check(await sb.rpc('admin_reports'));
    },
    async dismissReport(reportId) {
      check(await sb.rpc('admin_dismiss_report', { report: reportId }));
    },
    // Removes the post, then exactly its photo files (the only ones the admin may delete).
    async adminDeletePost(postId) {
      const paths = check(await sb.rpc('admin_delete_post', { post: postId })) ?? [];
      if (paths.length) await sb.storage.from('photos').remove(paths);
      await sb.rpc('admin_clear_cleanup', { paths });
    },
    async removeMember(memberId) {
      const paths = check(await sb.rpc('admin_remove_member', { member: memberId })) ?? [];
      if (paths.length) await sb.storage.from('photos').remove(paths);
      await sb.rpc('admin_clear_cleanup', { paths });
    },
    // Deletes my photo files first (I'm allowed to), then my account and everything in it.
    async deleteMyAccount() {
      const paths = check(await sb.rpc('my_photo_paths')) ?? [];
      if (paths.length) await sb.storage.from('photos').remove(paths);
      check(await sb.rpc('delete_my_account'));
      await sb.auth.signOut();
    },

    // ---- last seen
    async touchPresence() {
      await sb.rpc('touch_presence');
    },
    async lastSeen(id) {
      const { data, error } = await sb.from('presence').select('last_seen_at').eq('user_id', id).maybeSingle();
      if (error) return null;           // e.g. before 05_last_seen.sql has been run
      return data?.last_seen_at ?? null;
    },

    // ---- activity
    async listActivity() {
      const rows = check(await sb.rpc('my_activity'));
      return withUrls(rows, [['actor_avatar_path', 'actor_avatar_url']]);
    },
    async activityUnread() {
      // Counted the way the Activity screen shows it: hearts on one post are one line.
      const me = await uid();
      const [rows, prof] = await Promise.all([
        sb.rpc('my_activity').then(check),
        sb.from('profiles').select('activity_seen_at').eq('id', me).single().then(check),
      ]);
      return groupActivity(rows.filter((r) => r.created_at > prof.activity_seen_at)).length;
    },
    async markActivitySeen() {
      return check(await sb.rpc('mark_activity_seen'));
    },

    // ---- members & friendships
    async listMembers() {
      const rows = check(await sb.rpc('members_list'));
      return withUrls(rows, [['avatar_path', 'avatar_url']]);
    },
    async friendshipStatus(id) {
      return check(await sb.rpc('friendship_status', { other: id }));
    },
    async sendFriendRequest(id) {
      return check(await sb.rpc('send_friend_request', { other: id }));
    },
    async respondFriendRequest(id, accept) {
      return check(await sb.rpc('respond_friend_request', { other: id, accept }));
    },
    async removeFriend(id) {
      return check(await sb.rpc('remove_friend', { other: id }));
    },

    // ---- friends list
    async listFriends() {
      const rows = check(await sb.rpc('friends_list'));
      return withUrls(rows, [['avatar_path', 'avatar_url']]);
    },
    async markViewed(friendId) {
      await sb.rpc('mark_feed_viewed', { friend: friendId });
    },

    // ---- posts
    async listPosts(authorId, before) {
      let q = sb.from('post_details').select('*').eq('author_id', authorId)
        .order('created_at', { ascending: false }).limit(PAGE);
      if (before) q = q.lt('created_at', before);
      const rows = check(await q);
      const paths = (r) => (r.image_paths?.length ? r.image_paths : r.image_path ? [r.image_path] : []);
      const get = await resolvePaths(rows.flatMap(paths));
      return {
        posts: rows.map((r) => {
          const urls = paths(r).map(get).filter(Boolean);
          return { ...r, image_urls: urls, image_url: urls[0] ?? null };
        }),
        hasMore: rows.length === PAGE,
      };
    },
    async createPost({ body, files = [], link_url }) {
      const me = await uid();
      const image_paths = [];
      const image_ratios = [];
      for (const f of files.slice(0, 4)) {
        const { blob, ratio } = await compressPhoto(f);
        image_paths.push(await upload('posts', blob));
        image_ratios.push(ratio ?? 1);
      }
      const { error } = await sb.from('posts').insert({
        author_id: me, body, link_url: link_url || null,
        image_path: image_paths[0] ?? null, image_paths, image_ratios,
      });
      if (error && /image_paths|image_ratios/.test(error.message)) {
        // The multiple-photos update (06) hasn't been run yet: keep the first photo only.
        if (image_paths.length > 1) await sb.storage.from('photos').remove(image_paths.slice(1));
        check(await sb.from('posts').insert({ author_id: me, body, link_url: link_url || null, image_path: image_paths[0] ?? null }));
      } else if (error) {
        throw new Error(error.message);
      }
    },
    async updatePost(post, { body, link_url }) {
      check(await sb.from('posts').update({ body, link_url: link_url || null }).eq('id', post.id));
    },
    async deletePost(post) {
      check(await sb.from('posts').delete().eq('id', post.id));
      const paths = post.image_paths?.length ? post.image_paths : post.image_path ? [post.image_path] : [];
      if (paths.length) await sb.storage.from('photos').remove(paths);
    },

    // ---- hearts
    async setHeart(post, on) {
      const me = await uid();
      if (on) {
        const { error } = await sb.from('hearts').insert({ post_id: post.id, user_id: me });
        if (error && error.code !== '23505') throw new Error(error.message); // already hearted is fine
      } else {
        check(await sb.from('hearts').delete().eq('post_id', post.id).eq('user_id', me));
      }
    },
    async listHearts(postId) {
      return check(await sb.rpc('post_hearts', { post: postId }));
    },

    // ---- comments
    async listComments(postId) {
      const rows = check(await sb.from('comments')
        .select('*, author:profiles!comments_author_id_fkey(id, display_name, avatar_path)')
        .eq('post_id', postId).order('created_at'));
      const get = await resolvePaths(rows.map((r) => r.author?.avatar_path));
      const me = await uid();
      const hearts = rows.length ? check(await sb.from('comment_hearts')
        .select('comment_id, user_id, user:profiles!comment_hearts_user_id_fkey(display_name)')
        .in('comment_id', rows.map((r) => r.id))
        .order('created_at')) : [];
      return rows.map((r) => {
        const mine = hearts.filter((h) => h.comment_id === r.id);
        return {
          ...r,
          author: r.author && { ...r.author, avatar_url: get(r.author.avatar_path) },
          heart_count: mine.length,
          hearted_by_me: mine.some((h) => h.user_id === me),
          hearted_by: mine.map((h) => (h.user_id === me ? 'you' : h.user?.display_name ?? 'someone')),
        };
      });
    },
    async setCommentHeart(commentId, on) {
      const me = await uid();
      if (on) {
        const { error } = await sb.from('comment_hearts').insert({ comment_id: commentId, user_id: me });
        if (error && error.code !== '23505') throw new Error(error.message);
      } else {
        check(await sb.from('comment_hearts').delete().eq('comment_id', commentId).eq('user_id', me));
      }
    },
    async addComment(postId, body) {
      const me = await uid();
      check(await sb.from('comments').insert({ post_id: postId, author_id: me, body }));
    },
    async updateComment(id, body) {
      check(await sb.from('comments').update({ body }).eq('id', id));
    },
    async deleteComment(id) {
      check(await sb.from('comments').delete().eq('id', id));
    },

    // ---- invite codes (admin)
    async listInvites() {
      const rows = check(await sb.from('invite_codes')
        .select('code, created_at, used_at, user:profiles!invite_codes_used_by_fkey(display_name)')
        .order('used_at', { ascending: true, nullsFirst: true })
        .order('created_at'));
      return rows.map((r) => ({ code: r.code, used_at: r.used_at, used_by_name: r.user?.display_name ?? null }));
    },
    async createInvites(n) {
      check(await sb.rpc('create_invite_codes', { how_many: n }));
    },
  };
}
