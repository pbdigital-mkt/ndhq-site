// Tiny GitHub login helper for the Decap CMS editor at /admin. No dependencies (needs Node 18+).
// Environment variables: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SITE_ORIGIN (for example https://ndhq-site.onrender.com)
const http = require('http');
const crypto = require('crypto');

const ID = process.env.GITHUB_CLIENT_ID;
const SECRET = process.env.GITHUB_CLIENT_SECRET;
const SITE = (process.env.SITE_ORIGIN || '').replace(/\/+$/, '');
const PORT = process.env.PORT || 3000;
const SCOPE = process.env.GITHUB_SCOPE || 'repo,user';
const states = new Map();

const esc = (s) => JSON.stringify(s).replace(/</g, '\\u003c');

function done(res, ok, payload) {
  const msg = 'authorization:github:' + (ok ? 'success' : 'error') + ':' + JSON.stringify(payload);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><meta charset="utf-8"><title>Signing in</title><p>Signing in…</p><script>
(function () {
  var msg = ${esc(msg)}, site = ${esc(SITE)};
  function receive(e) {
    if (site && e.origin !== site) return;
    window.opener.postMessage(msg, e.origin);
    window.removeEventListener('message', receive, false);
    setTimeout(function () { window.close(); }, 300);
  }
  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>`);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/auth') {
      if (!ID || !SECRET || !SITE) { res.writeHead(500); return res.end('Server is missing GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET or SITE_ORIGIN.'); }
      const state = crypto.randomBytes(16).toString('hex');
      states.set(state, Date.now());
      for (const [k, t] of states) if (Date.now() - t > 10 * 60 * 1000) states.delete(k);
      const q = new URLSearchParams({ client_id: ID, scope: SCOPE, state });
      res.writeHead(302, { Location: 'https://github.com/login/oauth/authorize?' + q });
      return res.end();
    }
    if (url.pathname === '/callback') {
      const state = url.searchParams.get('state'), code = url.searchParams.get('code');
      if (!code || !states.has(state)) return done(res, false, { message: 'Login expired. Close this window and try again.' });
      states.delete(state);
      const r = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_id: ID, client_secret: SECRET, code }),
      });
      const data = await r.json();
      if (!data.access_token) return done(res, false, { message: data.error_description || 'GitHub did not return a token.' });
      return done(res, true, { token: data.access_token, provider: 'github' });
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('NDHQ login helper is running.');
  } catch (e) {
    console.error(e);
    done(res, false, { message: 'Login failed. Try again.' });
  }
}).listen(PORT, () => console.log('Listening on ' + PORT));
