# Sign-in and saved conversations (Supabase)

Visitors can sign in with Google to save their Ask conversations. Guests can still browse and ask; nothing is stored for them.

- **Supabase Auth** handles the Google sign-in. The site never sees passwords.
- **Supabase Postgres** stores conversations (`schema.sql`). Row-level security means each signed-in user can only read or change their own rows, so the browser can talk to the database directly with the public "anon" key.
- The site code is in `src/auth.jsx` (sign-in), `src/ask/store.js` (saving and loading) and `src/pages/Ask.jsx` (sidebar). Until `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `src/config.js` are filled in, sign-in is hidden.

## One-time setup (about 20 minutes)

### 1. Create the Supabase project
1. Sign up at <https://supabase.com> (the GitHub login is fine) and create a **New project** on the free plan. Pick a region near most visitors (e.g. Canada Central or US East) and save the database password somewhere safe.
2. When it's ready, open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**.
3. Open **Project Settings → API** (or **Data API**) and copy the **Project URL** and the **anon public** key. Both are public by design.

### 2. Create the Google login client
1. Go to <https://console.cloud.google.com/>, create a project (e.g. "CricStats").
2. **APIs & Services → OAuth consent screen**: choose **External**, app name "CricStats", your email as support and developer contact. Scopes: leave the defaults (email, profile, openid). Publish the app ("In production") so anyone can sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorised JavaScript origins: `https://patilamay.github.io`
   - Authorised redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows this exact address under Authentication → Sign In / Providers → Google)
4. Copy the **Client ID** and **Client secret**.

### 3. Connect Google to Supabase
1. Supabase: **Authentication → Sign In / Providers → Google** → enable, paste the Client ID and Client secret, save.
2. **Authentication → URL Configuration**:
   - Site URL: `https://patilamay.github.io/cricstats/`
   - Redirect URLs: add `https://patilamay.github.io/cricstats/**` (and `http://localhost:5173/**` for local testing)

### 4. Switch it on
Put the Project URL and anon key into `src/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) and merge. The site redeploys in about a minute and shows a **Sign in** button.

## Good to know
- **Free plan limits:** 50,000 monthly signed-in users and 500 MB of database, far more than this site needs. Free projects pause after a week with no activity; the nightly data refresh makes one tiny request to keep it awake. If it ever pauses, restore it from the Supabase dashboard (nothing is lost).
- **Limits per user:** 200 saved conversations, 100 questions per conversation (enforced in the database).
- **Delete my account:** the Privacy page calls `delete_my_account()`, which removes the user and, through cascades, all their conversations.
- **Looking at the data:** Supabase's Table Editor or SQL Editor, e.g. `select count(*) from conversations;`.
- **Tests:** `supabase/test/schema.test.js` runs the schema in an in-memory Postgres and checks the security rules (part of `npm test`).
