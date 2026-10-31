import { groupActivity } from '../lib/activity.js';
// A pretend backend that lives in memory, so the app can be tried with no
// accounts or setup. Nothing is saved: reloading the page resets it.

const wait = (ms = 180) => new Promise((r) => setTimeout(r, ms));
const ago = (mins) => new Date(Date.now() - mins * 60_000).toISOString();

// Little Aero-ish landscape "photos" drawn as SVG.
function scene(kind) {
  const P = {
    dawn:  ['#9FD8F2', '#FFE3CF', '#FFB38C', '#7CCB9A', '#3E9F78'],
    lake:  ['#6EC3EA', '#D9F2FB', '#FFF4D6', '#5BB8D4', '#2C7FA8'],
    dusk:  ['#7E9BE0', '#F7B9A6', '#FFD7A0', '#A27FB8', '#5C4E8C'],
    mesa:  ['#8FD0F0', '#E8F6FC', '#FFF0C9', '#E39A6E', '#B5583A'],
    field: ['#A6DEF5', '#F3FBFF', '#FFF7D1', '#A5DD8E', '#4FA563'],
  }[kind];
  const [skyTop, skyLow, sun, near, far] = P;
  let ground;
  if (kind === 'lake') {
    ground = `<path d="M0 520 C160 470 300 500 420 480 S700 470 800 500 V600 H0Z" fill="${far}" opacity=".55"/>
      <rect y="540" width="800" height="200" fill="${near}"/>
      <g fill="#fff" opacity=".5"><rect x="140" y="580" width="120" height="4" rx="2"/><rect x="420" y="620" width="200" height="4" rx="2"/><rect x="260" y="660" width="90" height="4" rx="2"/></g>`;
  } else if (kind === 'mesa') {
    ground = `<path d="M0 560 V470 H90 L120 420 H250 L280 470 H420 V560Z" fill="${near}"/>
      <path d="M380 560 V440 L410 400 H560 L600 450 H800 V560Z" fill="${far}"/>
      <rect y="555" width="800" height="200" fill="${near}" opacity=".9"/>`;
  } else {
    ground = `<path d="M0 520 C150 440 320 470 450 500 S700 440 800 470 V1000 H0Z" fill="${far}" opacity=".7"/>
      <path d="M0 600 C200 520 420 560 560 590 S740 560 800 580 V1000 H0Z" fill="${near}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${kind === 'field' ? 1000 : 600}" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset=".75" stop-color="${skyLow}"/></linearGradient>
    <radialGradient id="g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${sun}"/><stop offset="1" stop-color="${sun}" stop-opacity="0"/></radialGradient></defs>
    <rect width="800" height="1000" fill="url(#s)"/>
    <circle cx="560" cy="300" r="180" fill="url(#g)"/>
    <g fill="#fff" opacity=".75"><ellipse cx="180" cy="150" rx="90" ry="22"/><ellipse cx="240" cy="135" rx="60" ry="26"/><ellipse cx="620" cy="110" rx="70" ry="16"/></g>
    <g fill="#fff" opacity=".22"><circle cx="90" cy="300" r="40"/><circle cx="150" cy="380" r="18"/><circle cx="700" cy="420" r="26"/></g>
    ${ground}
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function initialData() {
  const me = { id: 'me', display_name: 'Hunter', bio: 'Making films, mostly about cheese.', avatar_url: null, is_admin: true };
  const friends = [
    { id: 'maya',  display_name: 'Maya Chen',     bio: 'Garden person. Bad at houseplants, good at tomatoes.' },
    { id: 'theo',  display_name: 'Theo Alvarez',  bio: 'Bikes, bread, long walks.' },
    { id: 'priya', display_name: 'Priya Shah',    bio: 'Reading too many books at once.' },
    { id: 'jonas', display_name: 'Jonas Berg',    bio: '' },
    { id: 'ruth',  display_name: 'Ruth Okafor',   bio: 'New city, who dis.' },
    { id: 'ben',   display_name: 'Ben Wilder',    bio: 'Mostly lurking.' },
  ].map((f) => ({ ...f, avatar_url: null, is_admin: false }));

  let n = 0;
  const post = (author_id, mins, body, extra = {}) => ({
    id: 'p' + ++n, author_id, body, created_at: ago(mins), edited_at: null,
    image_url: null, link_url: null, ...extra,
  });
  const posts = [
    post('maya', 25, 'First tomato of the season and it is absolutely enormous. I don’t know what to do with myself.', { image_url: scene('field') }),
    post('maya', 60 * 26, 'Anyone want zucchini? I have, conservatively, forty of them.'),
    post('maya', 60 * 24 * 6, 'Found the best explainer on soil pH, sharing for the gardeners here', { link_url: 'https://extension.example.edu/soil-ph-basics' }),
    post('theo', 60 * 3, 'Morning ride out to the lake. Cold, worth it.', { image_url: scene('lake') }),
    post('theo', 60 * 50, 'Sourdough attempt #6. Getting closer. Crumb still a little tight.'),
    post('priya', 60 * 30, 'Halfway through the book club pick and I have Opinions. Saving them for Thursday.'),
    post('priya', 60 * 24 * 4, '', { image_url: scene('dusk') }),
    post('jonas', 60 * 24 * 9, 'Moved desks at work and now I can see a tree. Life is good.'),
    post('ruth', 60 * 8, 'Week two in the new place. Took a drive out to the red rocks today.', { image_url: scene('mesa') }),
    post('me', 60 * 24 * 2, 'Welcome to Peachey, everyone! Post whatever you like. No algorithm, no ads, just us.', { image_url: scene('dawn') }),
  ];
  const hearts = [
    ['p1', 'theo'], ['p1', 'priya'], ['p1', 'me'], ['p4', 'maya'], ['p4', 'ruth'],
    ['p6', 'maya'], ['p9', 'theo'], ['p9', 'maya'], ['p10', 'maya'], ['p10', 'theo'], ['p10', 'priya'], ['p10', 'ruth'],
  ].map(([post_id, user_id], i) => ({ post_id, user_id, created_at: ago(20 - i) }));
  const comments = [
    { post_id: 'p1', author_id: 'theo', body: 'That is a tomato with ambition.', mins: 15 },
    { post_id: 'p1', author_id: 'priya', body: 'Caprese night at Maya’s?', mins: 9 },
    { post_id: 'p2', author_id: 'jonas', body: 'I will take six. Maybe seven.', mins: 60 * 25 },
    { post_id: 'p4', author_id: 'me', body: 'Which lake? Looks freezing.', mins: 60 * 2.5 },
    { post_id: 'p4', author_id: 'ruth', body: 'Gorgeous. Take me next time!', mins: 60 * 2 },
    { post_id: 'p10', author_id: 'maya', body: 'Love this. Thanks for making it 🍑', mins: 60 * 40 },
  ].map((c, i) => ({ id: 'c' + i, post_id: c.post_id, author_id: c.author_id, body: c.body, created_at: ago(c.mins), edited_at: null }));
  // When "you" last looked at each friend (drives the new-post dots).
  const views = { maya: ago(60 * 20), theo: ago(60 * 30), priya: ago(60 * 10), jonas: ago(60), ben: ago(60) };
  const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let seed = 0x9e3779b9;
  const rnd = () => { // mulberry32, so the sample codes look the same every reload
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return A[((t ^ (t >>> 14)) >>> 0) % 32];
  };
  const four = () => rnd() + rnd() + rnd() + rnd();
  const usedBy = ['Hunter', 'Maya Chen', 'Theo Alvarez', 'Priya Shah', 'Jonas Berg', 'Ruth Okafor', 'Ben Wilder'];
  const invites = Array.from({ length: 30 }, (_, i) => ({
    code: `PEACH-${four()}-${four()}`,
    used_at: i < usedBy.length ? ago(60 * 24 * (20 - i)) : null,
    used_by_name: usedBy[i] ?? null,
  }));
  // Where "you" stand with each member. Ben has sent you a request;
  // Jonas isn't a friend yet (his comment on Maya's post still shows).
  const friendships = { maya: 'friends', theo: 'friends', priya: 'friends', ruth: 'friends', ben: 'received', jonas: 'none' };
  const commentHearts = [
    { comment_id: 'c0', user_id: 'maya', created_at: ago(12) }, { comment_id: 'c0', user_id: 'priya', created_at: ago(8) },
    { comment_id: 'c1', user_id: 'maya', created_at: ago(6) }, { comment_id: 'c3', user_id: 'theo', created_at: ago(70) },
  ];
  // Friendship history for the Activity screen.
  const friendEvents = [
    { kind: 'friend_request', actor: 'ben', at: ago(45) },
    { kind: 'joined', actor: 'ruth', at: ago(60 * 24 * 15) },
    { kind: 'friend_accepted', actor: 'priya', at: ago(60 * 24 * 16) },
  ];
  return { me, people: [me, ...friends], posts, hearts, comments, commentHearts, friendEvents, views, invites, friendships,
    activitySeenAt: ago(60 * 3), signedIn: true, member: true };
}

export function makeDemoApi() {
  const db = initialData();
  let authCb = null;
  const person = (id) => db.people.find((p) => p.id === id);
  const decorate = (p) => ({
    ...p,
    heart_count: db.hearts.filter((h) => h.post_id === p.id).length,
    comment_count: db.comments.filter((c) => c.post_id === p.id).length,
    hearted_by_me: db.hearts.some((h) => h.post_id === p.id && h.user_id === 'me'),
  });

  return {
    isDemo: true,

    async getUserId() { await wait(80); return db.signedIn ? 'me' : null; },
    onAuthChange(cb) { authCb = cb; return () => { authCb = null; }; },
    async sendCode(email) {
      await wait(500);
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('That doesn’t look like an email address.');
    },
    async verifyCode(_email, token) {
      await wait(400);
      if (!/^\d{6,10}$/.test(token)) throw new Error('That code isn’t right. Check the email and try again.');
      db.signedIn = true;
      authCb?.('me');
    },
    async signOut() { db.signedIn = false; db.member = false; authCb?.(null); },

    async getMe() { await wait(80); return db.signedIn && db.member ? { ...db.me } : null; },
    async redeemInvite(code, name) {
      await wait(400);
      const inv = db.invites.find((i) => i.code === code.trim().toUpperCase());
      if (!inv || inv.used_at) {
        throw new Error('That invite code isn’t valid or has already been used');
      }
      db.me.display_name = name.trim().slice(0, 40) || db.me.display_name;
      inv.used_at = new Date().toISOString();
      inv.used_by_name = db.me.display_name;
      db.member = true;
    },
    async getProfile(id) { await wait(); const p = person(id); return p ? { ...p } : null; },
    async updateProfile({ display_name, bio, avatarFile }) {
      await wait(300);
      Object.assign(db.me, { display_name, bio });
      if (avatarFile) db.me.avatar_url = URL.createObjectURL(avatarFile);
    },

    async listMembers() {
      await wait();
      return db.people.filter((p) => p.id !== 'me')
        .map((p) => ({ ...p, status: db.friendships[p.id] ?? 'none' }))
        .sort((a, b) => ((b.status === 'received') - (a.status === 'received')) || a.display_name.localeCompare(b.display_name));
    },
    async listActivity() {
      await wait();
      const items = [];
      const mine = (p) => p.author_id === 'me';
      const post = (id) => db.posts.find((p) => p.id === id);
      const snip = (p) => p.body || (p.image_url ? 'your photo' : p.link_url);
      for (const h of db.hearts) {
        const p = post(h.post_id);
        if (p && mine(p) && h.user_id !== 'me') items.push({ kind: 'heart_post', actor_id: h.user_id, post_id: p.id, post_author_id: 'me', snippet: snip(p), created_at: h.created_at });
      }
      for (const c of db.comments) {
        const p = post(c.post_id);
        if (!p || c.author_id === 'me') continue;
        if (mine(p)) items.push({ kind: 'comment', actor_id: c.author_id, post_id: p.id, post_author_id: 'me', snippet: c.body, created_at: c.created_at });
        else {
          const myFirst = db.comments.filter((x) => x.post_id === p.id && x.author_id === 'me').map((x) => x.created_at).sort()[0];
          if (myFirst && c.created_at > myFirst) items.push({ kind: 'thread_comment', actor_id: c.author_id, post_id: p.id, post_author_id: p.author_id, snippet: c.body, created_at: c.created_at });
        }
      }
      for (const h of db.commentHearts) {
        const c = db.comments.find((x) => x.id === h.comment_id);
        if (c && c.author_id === 'me' && h.user_id !== 'me') items.push({ kind: 'heart_comment', actor_id: h.user_id, post_id: c.post_id, post_author_id: post(c.post_id)?.author_id, snippet: c.body, created_at: h.created_at });
      }
      for (const e of db.friendEvents) {
        if (e.kind === 'friend_request' && db.friendships[e.actor] !== 'received') continue;
        items.push({ kind: e.kind, actor_id: e.actor, post_id: null, post_author_id: null, snippet: null, created_at: e.at });
      }
      return items.map((i) => ({
        ...i,
        actor_name: person(i.actor_id).display_name, actor_avatar_url: person(i.actor_id).avatar_url,
        post_author_name: i.post_author_id ? person(i.post_author_id).display_name : null,
      })).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
    },
    async activityUnread() {
      const items = await this.listActivity();
      return groupActivity(items.filter((i) => i.created_at > db.activitySeenAt)).length;
    },
    async markActivitySeen() {
      const previous = db.activitySeenAt;
      db.activitySeenAt = new Date().toISOString();
      return previous;
    },
    async friendshipStatus(id) { await wait(80); return id === 'me' ? 'me' : db.friendships[id] ?? 'none'; },
    async sendFriendRequest(id) {
      await wait(250);
      const s = db.friendships[id] ?? 'none';
      db.friendships[id] = s === 'received' ? 'friends' : s === 'none' ? 'sent' : s;
      return db.friendships[id];
    },
    async respondFriendRequest(id, accept) {
      await wait(250);
      db.friendships[id] = accept ? 'friends' : 'none';
      return db.friendships[id];
    },
    async removeFriend(id) { await wait(250); db.friendships[id] = 'none'; return 'none'; },

    async listFriends() {
      await wait();
      return db.people.filter((p) => db.friendships[p.id] === 'friends').map((p) => {
        const mine = db.posts.filter((x) => x.author_id === p.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const last = mine[0];
        return {
          ...p,
          last_post_at: last?.created_at ?? null,
          last_post_preview: last ? (last.body || (last.image_url ? '📷 Photo' : '🔗 Link')).slice(0, 140) : null,
          post_count: mine.length,
          has_new: !!last && last.created_at > (db.views[p.id] ?? ''),
        };
      }).sort((a, b) => (b.has_new - a.has_new) || (b.last_post_at ?? '').localeCompare(a.last_post_at ?? '') || a.display_name.localeCompare(b.display_name));
    },
    async markViewed(id) { db.views[id] = new Date().toISOString(); },

    async listPosts(authorId) {
      await wait();
      if (authorId !== 'me' && db.friendships[authorId] !== 'friends') return { posts: [], hasMore: false };
      const posts = db.posts.filter((p) => p.author_id === authorId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).map(decorate);
      return { posts, hasMore: false };
    },
    async createPost({ body, file, link_url }) {
      await wait(500);
      db.posts.push({
        id: 'p' + Math.random().toString(36).slice(2), author_id: 'me', body,
        image_url: file ? URL.createObjectURL(file) : null, link_url: link_url || null,
        created_at: new Date().toISOString(), edited_at: null,
      });
    },
    async updatePost(post, { body, link_url }) {
      await wait(300);
      Object.assign(db.posts.find((p) => p.id === post.id), { body, link_url: link_url || null, edited_at: new Date().toISOString() });
    },
    async deletePost(post) {
      await wait(200);
      db.posts = db.posts.filter((p) => p.id !== post.id);
      db.comments = db.comments.filter((c) => c.post_id !== post.id);
      db.hearts = db.hearts.filter((h) => h.post_id !== post.id);
    },

    async setHeart(post, on) {
      await wait(120);
      db.hearts = db.hearts.filter((h) => !(h.post_id === post.id && h.user_id === 'me'));
      if (on) db.hearts.push({ post_id: post.id, user_id: 'me', created_at: new Date().toISOString() });
    },
    async listHearts(postId) {
      await wait(120);
      return db.hearts.filter((h) => h.post_id === postId).map((h) => {
        const p = person(h.user_id);
        return { user_id: p.id, display_name: p.display_name, avatar_url: p.avatar_url };
      });
    },

    async listComments(postId) {
      await wait(150);
      return db.comments.filter((c) => c.post_id === postId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c) => {
          const hs = db.commentHearts.filter((h) => h.comment_id === c.id);
          return {
            ...c, author: { ...person(c.author_id) },
            heart_count: hs.length,
            hearted_by_me: hs.some((h) => h.user_id === 'me'),
            hearted_by: hs.map((h) => (h.user_id === 'me' ? 'you' : person(h.user_id).display_name)),
          };
        });
    },
    async setCommentHeart(commentId, on) {
      await wait(120);
      db.commentHearts = db.commentHearts.filter((h) => !(h.comment_id === commentId && h.user_id === 'me'));
      if (on) db.commentHearts.push({ comment_id: commentId, user_id: 'me' });
    },
    async addComment(postId, body) {
      await wait(200);
      db.comments.push({ id: 'c' + Math.random().toString(36).slice(2), post_id: postId, author_id: 'me', body, created_at: new Date().toISOString(), edited_at: null });
    },
    async updateComment(id, body) { await wait(200); Object.assign(db.comments.find((c) => c.id === id), { body, edited_at: new Date().toISOString() }); },
    async deleteComment(id) { await wait(150); db.comments = db.comments.filter((c) => c.id !== id); },

    async listInvites() {
      await wait();
      return [...db.invites].sort((a, b) => (!!a.used_at - !!b.used_at));
    },
    demoInviteCode() { return db.invites.find((i) => !i.used_at)?.code; },
    async createInvites(n) {
      await wait(300);
      const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      const pick = () => Array.from({ length: 4 }, () => A[Math.floor(Math.random() * 32)]).join('');
      for (let i = 0; i < n; i++) db.invites.push({ code: `PEACH-${pick()}-${pick()}`, used_at: null, used_by_name: null });
    },
  };
}
