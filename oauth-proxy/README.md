# Login helper for the editor (Render)

Lets you log in to `/admin` with GitHub when the site is hosted on Render.

1. Put this `oauth-proxy` folder in your GitHub repository (next to `build.js`).
2. Render: New > Web Service > your repository. Settings: Root Directory `oauth-proxy`, Build Command `npm install`, Start Command `node server.js`, Instance type Free. Create it and note its address, for example `https://ndhq-login.onrender.com`.
3. GitHub: Settings > Developer settings > OAuth Apps > New OAuth App.
   - Homepage URL: your site address (`https://ndhq-site.onrender.com`)
   - Authorization callback URL: `https://ndhq-login.onrender.com/callback` (the helper's address plus `/callback`)
   Create it, then Generate a new client secret.
4. Render > the login helper > Environment, add:
   - `GITHUB_CLIENT_ID` the Client ID
   - `GITHUB_CLIENT_SECRET` the secret
   - `SITE_ORIGIN` your site address, no trailing slash, for example `https://ndhq-site.onrender.com`
   Save (it restarts).
5. In the repository edit `admin/config.yml`: set `base_url:` to the helper's address. Commit. The site redeploys.
6. Open `https://ndhq-site.onrender.com/admin` and press Login with GitHub.

The free helper sleeps when idle, so the first login after a quiet period can take up to a minute.
Only GitHub accounts with write access to the repository can publish changes.
