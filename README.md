# NDHQ website

A static website with an editor at `/admin` for changing text and photos without touching code.

## What is in the folder

- `template.html` the page design (you normally never edit this)
- `content/site.json` all the text and photo settings (the editor changes this file)
- `content/images/` uploaded photos
- `admin/` the editor (Decap CMS)
- `build.js` joins the template and content into the finished page (`node build.js`, no installs needed)
- `netlify.toml`, `vercel.json` hosting settings

## Put it online with Netlify (recommended, about 15 minutes)

1. Create a free GitHub account, then a new empty repository (private is fine), for example `ndhq-site`.
2. On the repository page choose "uploading an existing file" and drag in everything from this folder. Commit.
3. Open `admin/config.yml` on GitHub, click the pencil, and change the line `repo: YOUR-GITHUB-USERNAME/YOUR-REPO-NAME` to your real username and repository name. Commit.
4. Create a free Netlify account. Choose Add new site, Import an existing project, GitHub, and pick the repository. The build settings are read from `netlify.toml`, so just press Deploy. Your site is live at a `*.netlify.app` address (you can add your own domain under Domain management).
5. Let the editor log in with GitHub:
   - On GitHub go to Settings, Developer settings, OAuth Apps, New OAuth App. Homepage URL is your Netlify address. Authorization callback URL is `https://api.netlify.com/auth/done`. Create it, then generate a client secret.
   - In Netlify open Site configuration, Access & security, OAuth, Install provider, choose GitHub, and paste the Client ID and secret.
6. Go to `https://YOUR-SITE/admin`, log in with GitHub, and edit. Each Publish saves to GitHub and Netlify rebuilds the site in under a minute.

## Using the editor

- Open "All page text and photos". Sections follow the page order. Each field says what it is and starts with the original wording.
- Hide a section: under "Show or hide sections" switch off the ones you do not want (for example Client quotes). The section and its menu link disappear, and your text is kept for when you switch it back on.
- Photos: add one under "Photos" to replace the About card area or a case study picture. Use JPG or PNG up to about 1600 px wide, and fill in the description for accessibility.
- The headline is split in pieces so the two highlighted words stay highlighted: "performs" and "lasts" are their own fields.

## Vercel instead

Vercel hosts it fine (it reads `vercel.json`), but Decap needs a small login helper for GitHub there, which Netlify provides built in. If you use Vercel you must run an OAuth proxy and add `base_url: https://YOUR-PROXY` under `backend:` in `admin/config.yml`.

## Not editable in the editor

Menu link names, the text inside the three generated brand boards and the service illustrations, and the animated hero picture. Replace a brand board with a photo, or ask for a field to be added.

## Changing the design later

Edit `template.html` and keep the `{{t12}}`-style placeholders. If you add new text, add a matching entry in `content/site.json` and a field in `admin/config.yml`.
