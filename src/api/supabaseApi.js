import { createClient } from '@supabase/supabase-js';
import { compressImage } from '../lib/image.js';

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
      const rows = check(await sb.from('profiles').select('id, display_name, bio, avatar_path').eq('id', id));
      if (!rows.length) return null;
      return (await withUrls(rows, [['avatar_path', 'avatar_url']]))[0];
    },
    async updateProfile({ display_name, bio, avatarFile }) {
      const me = await uid();
      const patch = { display_name, bio };
      if (avatarFile) {
        const blob = await compressImage(avatarFile, { maxSize: 480, square: true });
        patch.avatar_path = await upload('avatar', blob);
      }
      check(await sb.from('profiles').update(patch).eq('id', me));
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
      return {
        posts: await withUrls(rows, [['image_path', 'image_url']]),
        hasMore: rows.length === PAGE,
      };
    },
    async createPost({ body, file, link_url }) {
      const me = await uid();
      let image_path = null;
      if (file) image_path = await upload('posts', await compressImage(file));
      check(await sb.from('posts').insert({ author_id: me, body, image_path, link_url: link_url || null }));
    },
    async updatePost(post, { body, link_url }) {
      check(await sb.from('posts').update({ body, link_url: link_url || null }).eq('id', post.id));
    },
    async deletePost(post) {
      check(await sb.from('posts').delete().eq('id', post.id));
      if (post.image_path) await sb.storage.from('photos').remove([post.image_path]);
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
      return rows.map((r) => ({ ...r, author: r.author && { ...r.author, avatar_url: get(r.author.avatar_path) } }));
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
