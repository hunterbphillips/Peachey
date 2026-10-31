# Peaches

A private little place for friends. Everyone has a profile with their own feed
of text, photo and link posts that friends can heart and comment on. The home
screen is a list of your friends, with a dot next to anyone who has posted
since you last looked.

Everyone can see the member list (names, bios, profile photos) and send friend
requests. Posts, and their photos, hearts and comments, are visible only to
the author and their friends. Using an invite code makes you friends with
whoever made it.

- **App:** React + Vite, installable to a phone’s home screen (no app store).
- **Backend:** Supabase (sign-in, database, photo storage).
- **Hosting:** Vercel.
- **Email:** Resend, for sending sign-in codes.

With no Supabase keys set, the app runs as a demo with sample friends
(add `?demo` to any URL to force this).

---

## How the pieces fit

| Piece | What it does | Cost at 15–20 people |
|---|---|---|
| Supabase | Accounts, posts, hearts, comments, photos | Free (500 MB data, 1 GB photos) |
| Vercel | Serves the app | Free (Hobby, personal use) |
| Resend | Emails sign-in codes | Free (3,000 emails/month) |
| A domain | Lets Resend send email to anyone, and gives a nice address | ~$10–15/year |

Photos are shrunk on the phone before upload (to about 200–400 KB), so the free
1 GB holds roughly 3,000 photos.

---

## Setup

### 1. GitHub
Create a free account and an **empty** repository named `peachey` (private is
fine). Claude can push the code into it for you.

### 2. Supabase
1. Create a free account and a new project. Save the database password
   somewhere safe; you won’t need it day to day.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and
   click **Run**. The results panel lists your first 30 invite codes.
   Then do the same with `supabase/02_friends.sql` (friendships),
   `supabase/03_comment_hearts.sql` (hearts on comments) and
   `supabase/04_activity.sql` (the Activity screen) and
   `supabase/05_last_seen.sql` ("last seen" on profiles), in that order.
3. In **Project Settings → API**, copy the **Project URL** and the
   **anon / public** key. Never share the `service_role` key.

### 3. Email (needed before friends can sign in)
Supabase’s built-in email only sends to your own Supabase team members, two
messages an hour. To email friends:

1. Buy a domain (for example from Cloudflare or Porkbun).
2. Create a free Resend account, add your domain, and add the DNS records it
   shows you at your domain registrar. Wait for Resend to mark it verified.
3. In Resend, create an API key.
4. In Supabase, open the Auth email settings and turn on **custom SMTP**:
   - Host `smtp.resend.com`, port `465`, username `resend`
   - Password: your Resend API key
   - Sender: something like `peachey@yourdomain.com`, name `Peaches`
5. In the Supabase email templates, replace both **Magic Link** and
   **Confirm signup** with `supabase/email-template.html`. This puts a
   6-digit code in the email. People type the code into the app instead of
   tapping a link, because on iPhone a link opens Safari rather than the
   home-screen app and they’d end up signed in in the wrong place.

### 4. Vercel
1. Sign up with your GitHub account and **Import** the `Peaches` repository.
   Vercel detects Vite automatically.
2. Click **Deploy**. No settings are needed: the Supabase address and public
   key are in `.env.production`. (Both are safe to publish; the database's
   security rules are what keep strangers out.)
3. To use your domain, add it under **Settings → Domains**.
4. From now on, every change pushed to GitHub redeploys automatically.

### 5. Point Supabase at the app
In Supabase’s Auth **URL Configuration**, set the **Site URL** to your app’s
address (your domain, or the `….vercel.app` address) and add the same address
under **Redirect URLs**.

### 6. Join first
Open the app, sign in with your email, and redeem one of the invite codes.
**The first person to join becomes the admin**, so do this before sending any
codes out. As admin you’ll see **Invite codes** on your profile, where you can
copy a ready-made invite message for each code or make 10 more.

### Adding it to a phone
- **iPhone:** open the site in Safari → Share → **Add to Home Screen**.
- **Android:** open it in Chrome → menu → **Add to Home screen** / **Install app**.

---

## Good to know

- **Free projects pause** after a week with no activity. If that happens,
  open the Supabase dashboard and click **Restore**. Upgrading to Pro
  ($25/month) stops this.
- **Changing a post’s photo:** editing covers text and links. To swap a photo,
  delete the post and post again.
- **Privacy:** every table is locked so that only members can read anything,
  only friends can see each other’s posts, and people can only change or
  delete their own posts, comments, hearts and photos. Photos live in a
  private bucket and are shown through short-lived links.
- **Removing someone:** in Supabase, open Authentication → Users and delete
  them. Their profile, posts and comments go with them.

## Working on the code

```bash
npm install
cp .env.example .env      # fill in the two values, or leave blank for the demo
npm run dev               # local preview
npm run build             # production build in dist/
npm run build:demo        # single-file demo in dist-demo/
```

Code layout:

- `src/screens/` — sign-in, invite code, friends list, people & requests, feed, profile editing, invite codes
- `src/components/` — post card, comments, composer and shared pieces
- `src/api/supabaseApi.js` — everything that talks to Supabase
- `src/api/demoApi.js` — the in-memory demo
- `supabase/schema.sql` — tables, security rules, storage, invite codes
- `supabase/02_friends.sql` — friendships and friends-only visibility (run after schema.sql)
- `supabase/03_comment_hearts.sql` — hearts on comments (run after 02_friends.sql)
- `supabase/04_activity.sql` — the Activity screen (run after 03_comment_hearts.sql)
- `supabase/05_last_seen.sql` — "last seen" for friends, with an off switch (run after 04_activity.sql)
