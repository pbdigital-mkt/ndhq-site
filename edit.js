/* NDHQ visual editor: click any text on the real page and type; save sends the change to GitHub. */
(function () {
  'use strict';
  var C = window.NDHQ_EDIT;
  var TOKEN_KEY = 'ndhq-edit-token';
  var API = 'https://api.github.com';
  var LABELS = { marquee: 'Scrolling strip', services: 'Services', work: 'Selected work', approach: 'Approach', method: 'How it works', words: 'Client quotes', about: 'About' };

  var state = { json: null, sha: null, text: {}, vis: {}, photos: {}, settings: {}, dirty: false, ready: false };
  var pending = {}; // slot -> { b64, dataUrl } or { remove: true }
  var orig = {};    // slot -> original HTML for the generated picture

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  // ---------- styles ----------
  var css = document.createElement('style');
  css.textContent = [
    '.ed-t{outline:none;border-radius:3px;transition:background .15s}',
    '.ed-on .ed-t{cursor:text}',
    '.ed-on .ed-t:hover{outline:1.5px dashed #AF781B;outline-offset:3px}',
    '.ed-on .ed-t:focus{outline:2px solid #AF781B;outline-offset:3px;background:rgba(175,120,27,.1)}',
    '.ed-on .ed-t.ed-changed{background:rgba(175,120,27,.14)}',
    '[data-sec].ed-hidden{opacity:.3;filter:grayscale(.6)}',
    '[data-nav].ed-hidden{display:none!important}',
    '.portrait.ed-empty{min-height:150px;display:grid;place-items:center;border:2px dashed #AF781B;border-radius:6px;color:#926416;font:600 14px/1.4 Montserrat,system-ui,sans-serif;text-align:center;padding:24px}',
    '.ed-ui{font:600 14px/1.3 Montserrat,system-ui,sans-serif;color:#fff;box-sizing:border-box}',
    '.ed-ui *{box-sizing:border-box}',
    '#ed-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;background:#2B4381;padding:10px 12px;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.35);max-width:calc(100vw - 24px)}',
    '#ed-bar button,#ed-bar a,.ed-photo button{font:inherit;color:#fff;background:rgba(255,255,255,.14);border:0;border-radius:9px;padding:9px 14px;cursor:pointer;text-decoration:none;white-space:nowrap}',
    '#ed-bar button:hover,#ed-bar a:hover,.ed-photo button:hover{background:rgba(255,255,255,.26)}',
    '#ed-bar button.go{background:#AF781B}',
    '#ed-bar button.go:hover{background:#c58a24}',
    '#ed-bar button[disabled]{opacity:.45;cursor:default}',
    '#ed-msg{padding:0 6px;max-width:340px;font-weight:500}',
    '.ed-photo{position:absolute;z-index:9999;display:flex;gap:6px}',
    '.ed-photo button{background:#2B4381;box-shadow:0 4px 14px rgba(0,0,0,.3)}',
    '#ed-panel{position:fixed;right:16px;bottom:84px;z-index:99998;width:min(360px,calc(100vw - 32px));max-height:calc(100vh - 120px);overflow:auto;background:#fff;color:#1d2433;border-radius:14px;box-shadow:0 14px 50px rgba(0,0,0,.35);padding:18px;display:none}',
    '#ed-panel.open{display:block}',
    '#ed-panel h4{margin:0 0 10px;font:700 15px Montserrat,system-ui,sans-serif;color:#2B4381}',
    '#ed-panel label{display:flex;gap:10px;align-items:center;padding:7px 0;font:500 14px Montserrat,system-ui,sans-serif;color:#1d2433}',
    '#ed-panel .fld{display:block;margin:8px 0}',
    '#ed-panel .fld span{display:block;font:600 12px Montserrat,system-ui,sans-serif;color:#564A3C;margin-bottom:4px}',
    '#ed-panel input[type=text],#ed-panel textarea{width:100%;font:500 14px Montserrat,system-ui,sans-serif;padding:8px 10px;border:1px solid #cfc8bd;border-radius:8px;color:#1d2433;background:#fff}',
    '#ed-panel hr{border:0;border-top:1px solid #e6e0d6;margin:14px 0}',
    '#ed-login{position:fixed;inset:0;z-index:100000;background:rgba(20,28,50,.72);display:grid;place-items:center;padding:20px}',
    '#ed-login div{background:#fff;color:#1d2433;border-radius:16px;padding:28px;max-width:420px;text-align:center;font:500 15px/1.5 Montserrat,system-ui,sans-serif}',
    '#ed-login h3{margin:0 0 8px;font:700 20px Montserrat,system-ui,sans-serif;color:#2B4381}',
    '#ed-login button{margin-top:14px;font:600 15px Montserrat,system-ui,sans-serif;color:#fff;background:#2B4381;border:0;border-radius:10px;padding:12px 20px;cursor:pointer}',
    '#ed-login p.err{color:#a02020;font-size:13px;margin:10px 0 0}'
  ].join('\n');
  document.head.appendChild(css);

  // ---------- UI ----------
  var bar = el('div', { id: 'ed-bar', class: 'ed-ui' });
  var msg = el('span', { id: 'ed-msg', text: 'Loading…' });
  var btnSections = el('button', { type: 'button', text: 'Sections and page info' });
  var btnSave = el('button', { type: 'button', class: 'go', text: 'Save changes' });
  btnSave.disabled = true;
  var btnExit = el('a', { href: '/', text: 'View site' });
  bar.appendChild(msg); bar.appendChild(btnSections); bar.appendChild(btnSave); bar.appendChild(btnExit);
  document.body.appendChild(bar);
  var panel = el('div', { id: 'ed-panel', class: 'ed-ui' });
  document.body.appendChild(panel);
  var fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  document.body.appendChild(fileInput);

  function say(t, bad) { msg.textContent = t; msg.style.color = bad ? '#ffb4a8' : '#fff'; }
  function setDirty(v) { state.dirty = v; btnSave.disabled = !v; if (v) say('You have unsaved changes.'); }
  window.addEventListener('beforeunload', function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // links never navigate while editing
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (a && !a.closest('.ed-ui')) e.preventDefault();
  }, true);

  // ---------- GitHub API ----------
  function gh(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: { Authorization: 'token ' + getToken(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 401) { setToken(null); throw { code: 'auth' }; }
      return r.json().then(function (j) { if (!r.ok) throw { code: r.status, message: j && j.message }; return j; });
    });
  }
  function b64enc(str) { var b = new TextEncoder().encode(str), s = ''; for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function b64dec(b64) { var s = atob(b64.replace(/\s/g, '')), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return new TextDecoder().decode(b); }
  function fileUrl() { return '/repos/' + C.repo + '/contents/' + C.file; }

  function loadRemote() {
    return gh(fileUrl() + '?ref=' + encodeURIComponent(C.branch) + '&t=' + Date.now()).then(function (r) {
      state.json = JSON.parse(b64dec(r.content));
      state.sha = r.sha;
    });
  }

  // ---------- login ----------
  function showLogin(errText) {
    var old = $('#ed-login'); if (old) old.remove();
    var err = el('p', { class: 'err', text: errText || '' });
    var b = el('button', { type: 'button', text: 'Log in with GitHub' });
    var box = el('div', {}, [el('h3', { text: 'Edit your site' }), el('span', { text: 'Log in with GitHub to edit the text and photos right on the page.' }), el('br'), b, err]);
    var wrap = el('div', { id: 'ed-login', class: 'ed-ui' }, [box]);
    document.body.appendChild(wrap);
    b.addEventListener('click', function () {
      var origin; try { origin = new URL(C.helper).origin; } catch (e) { err.textContent = 'The login helper address is missing in admin/config.yml.'; return; }
      var w = window.open(C.helper + '/auth?provider=github&scope=repo', 'ndhq-login', 'width=620,height=720');
      if (!w) { err.textContent = 'The login window was blocked. Allow pop-ups for this site and try again.'; return; }
      function onMsg(ev) {
        if (ev.origin !== origin) return;
        var d = ev.data;
        if (d === 'authorizing:github') { w.postMessage('authorizing:github', ev.origin); return; }
        if (typeof d !== 'string') return;
        var ok = 'authorization:github:success:', bad = 'authorization:github:error:';
        if (d.indexOf(ok) === 0) {
          window.removeEventListener('message', onMsg);
          try { setToken(JSON.parse(d.slice(ok.length)).token); } catch (e) {}
          wrap.remove(); start();
        } else if (d.indexOf(bad) === 0) {
          window.removeEventListener('message', onMsg);
          var m = ''; try { m = JSON.parse(d.slice(bad.length)).message; } catch (e) {}
          err.textContent = m || 'Login failed. Try again.';
        }
      }
      window.addEventListener('message', onMsg);
    });
  }

  // ---------- content ----------
  function keyGroup(k) {
    for (var g in state.json) { var v = state.json[g]; if (v && typeof v === 'object' && !Array.isArray(v) && typeof v[k] === 'string' && g !== 'settings' && g !== 'visibility' && g !== 'photos') return g; }
    return null;
  }
  function applyRemote() {
    var j = state.json;
    $$('.ed-t').forEach(function (n) {
      var g = keyGroup(n.dataset.k);
      if (g && n.textContent !== j[g][n.dataset.k]) n.textContent = j[g][n.dataset.k];
      n.setAttribute('contenteditable', 'true');
    });
    var vis = j.visibility || {};
    Object.keys(vis).forEach(function (k) { setHidden(k, vis[k] === false); });
    var ph = j.photos || {};
    Object.keys(ph).forEach(function (s) { var cur = slotEl(s); if (cur && ph[s] && ph[s].image && !(cur.tagName === 'IMG' && cur.getAttribute('src') === ph[s].image) && !$('img', cur)) showImage(s, ph[s].image); });
    document.documentElement.classList.add('ed-on');
  }
  function slotEl(s) { return $('[data-slot="' + s + '"]'); }
  function setHidden(name, hide) {
    $$('[data-sec="' + name + '"]').forEach(function (n) { n.classList.toggle('ed-hidden', hide); });
    $$('[data-nav="' + name + '"]').forEach(function (n) { n.classList.toggle('ed-hidden', hide); });
  }

  // text editing: plain text only, one line of formatting
  document.addEventListener('input', function (e) {
    var t = e.target.closest && e.target.closest('.ed-t'); if (!t) return;
    state.text[t.dataset.k] = t.textContent; t.classList.add('ed-changed'); setDirty(true);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('.ed-t')) e.preventDefault();
  });
  document.addEventListener('paste', function (e) {
    var t = e.target.closest && e.target.closest('.ed-t'); if (!t) return;
    e.preventDefault();
    var txt = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, txt);
  });
  document.addEventListener('drop', function (e) { if (e.target.closest && e.target.closest('.ed-t')) e.preventDefault(); });

  // ---------- photos ----------
  var photoUI = {};
  function ensureOrig(s) { if (!orig[s]) { var t = $('#orig-' + s); orig[s] = t ? t.innerHTML : ''; } return orig[s]; }
  function showImage(s, src) {
    var cur = slotEl(s); if (!cur) return;
    var cls = s === 'about' ? '' : 'case-photo';
    if (cur.tagName === 'FIGURE') { cur.classList.remove('ed-empty'); cur.innerHTML = '<img src="' + src + '" alt="">'; }
    else if (cur.tagName === 'IMG') { cur.src = src; }
    else { ensureOrig(s); var img = el('img', { class: cls, src: src, alt: '', 'data-slot': s }); cur.replaceWith(img); }
    layoutPhotoUI();
  }
  function clearImage(s) {
    var cur = slotEl(s); if (!cur) return;
    if (cur.tagName === 'FIGURE') { cur.classList.add('ed-empty'); cur.innerHTML = '<span>No portrait yet. Click Add photo.</span>'; }
    else if (cur.tagName === 'IMG') {
      var h = ensureOrig(s), tmp = el('div'); tmp.innerHTML = h;
      var node = tmp.firstElementChild; if (node) { node.setAttribute('data-slot', s); cur.replaceWith(node); }
    }
    layoutPhotoUI();
  }
  function hasPhoto(s) {
    var cur = slotEl(s); if (!cur) return false;
    return cur.tagName === 'IMG' || (cur.tagName === 'FIGURE' && !!$('img', cur));
  }
  function downscale(file, max) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var r = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
        var d = c.toDataURL('image/jpeg', 0.86); URL.revokeObjectURL(url); res(d);
      };
      im.onerror = function () { rej(new Error('Could not read that image.')); };
      im.src = url;
    });
  }
  var pickFor = null;
  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0]; var s = pickFor; fileInput.value = '';
    if (!f || !s) return;
    say('Preparing photo…');
    downscale(f, s === 'about' ? 1200 : 1600).then(function (d) {
      pending[s] = { dataUrl: d, b64: d.split(',')[1] };
      showImage(s, d); setDirty(true);
    }).catch(function (e) { say(e.message, true); });
  });
  function layoutPhotoUI() {
    ['about', 'case1', 'case2', 'case3'].forEach(function (s) {
      var cur = slotEl(s), ui = photoUI[s];
      if (!cur) { if (ui) ui.style.display = 'none'; return; }
      if (!ui) {
        ui = photoUI[s] = el('div', { class: 'ed-photo ed-ui' });
        var change = el('button', { type: 'button' }); var remove = el('button', { type: 'button', text: 'Remove photo' });
        change.addEventListener('click', function () { pickFor = s; fileInput.click(); });
        remove.addEventListener('click', function () { pending[s] = { remove: true }; clearImage(s); setDirty(true); });
        ui.appendChild(change); ui.appendChild(remove); document.body.appendChild(ui);
      }
      var has = hasPhoto(s);
      ui.firstChild.textContent = has ? 'Change photo' : 'Add photo';
      ui.lastChild.style.display = has ? '' : 'none';
      var r = cur.getBoundingClientRect();
      ui.style.display = (r.width < 40 || cur.closest('.ed-hidden')) ? 'none' : 'flex';
      ui.style.top = (r.top + window.scrollY + 12) + 'px';
      ui.style.left = (r.left + window.scrollX + 12) + 'px';
    });
  }
  window.addEventListener('resize', layoutPhotoUI);
  window.addEventListener('load', layoutPhotoUI);
  if (window.ResizeObserver) new ResizeObserver(layoutPhotoUI).observe(document.body);

  // ---------- sections panel ----------
  function buildPanel() {
    panel.innerHTML = '';
    panel.appendChild(el('h4', { text: 'Show or hide sections' }));
    var vis = (state.json && state.json.visibility) || {};
    Object.keys(LABELS).forEach(function (k) {
      if (!(k in vis) && !$('[data-sec="' + k + '"]')) return;
      var cb = el('input', { type: 'checkbox' }); cb.checked = (state.vis[k] !== undefined ? state.vis[k] : vis[k]) !== false;
      cb.addEventListener('change', function () { state.vis[k] = cb.checked; setHidden(k, !cb.checked); setDirty(true); });
      panel.appendChild(el('label', {}, [cb, el('span', { text: LABELS[k] })]));
    });
    panel.appendChild(el('hr'));
    panel.appendChild(el('h4', { text: 'Search and sharing' }));
    var s = (state.json && state.json.settings) || {};
    [['meta_title', 'Page title (browser tab, Google)', 'input'], ['meta_description', 'Page description (Google, link previews)', 'textarea']].forEach(function (f) {
      var inp = el(f[2] === 'input' ? 'input' : 'textarea', f[2] === 'input' ? { type: 'text' } : { rows: '3' });
      inp.value = state.settings[f[0]] !== undefined ? state.settings[f[0]] : (s[f[0]] || '');
      inp.addEventListener('input', function () { state.settings[f[0]] = inp.value; setDirty(true); });
      panel.appendChild(el('label', { class: 'fld' }, [el('span', { text: f[1] }), inp]));
    });
  }
  btnSections.addEventListener('click', function () { panel.classList.toggle('open'); });

  // ---------- save ----------
  function mergeInto(base) {
    var out = JSON.parse(JSON.stringify(base));
    Object.keys(state.text).forEach(function (k) { var g = null; for (var x in out) { var v = out[x]; if (v && typeof v === 'object' && typeof v[k] === 'string' && x !== 'settings' && x !== 'visibility' && x !== 'photos') { g = x; break; } } if (g) out[g][k] = state.text[k].replace(/\s+/g, ' ').trim(); });
    out.visibility = Object.assign({}, out.visibility, state.vis);
    out.settings = Object.assign({}, out.settings, state.settings);
    out.photos = out.photos || {};
    Object.keys(state.photos).forEach(function (s) { out.photos[s] = Object.assign({ alt: '' }, out.photos[s], state.photos[s]); });
    return out;
  }
  function putFile(path, content64, sha, message) {
    var body = { message: message, content: content64, branch: C.branch }; if (sha) body.sha = sha;
    return gh('/repos/' + C.repo + '/contents/' + path, { method: 'PUT', body: body });
  }
  function save() {
    btnSave.disabled = true; say('Saving…');
    var slots = Object.keys(pending), ts = Date.now();
    var chain = Promise.resolve();
    slots.forEach(function (s) {
      var p = pending[s];
      if (p.remove) { state.photos[s] = { image: '', alt: '' }; return; }
      chain = chain.then(function () {
        var name = s + '-' + ts + '.jpg';
        return putFile(C.imgDir.replace(/\/+$/, '') + '/' + name, p.b64, null, 'Add photo ' + name).then(function () {
          state.photos[s] = { image: C.publicDir.replace(/\/+$/, '') + '/' + name, alt: '' };
        });
      });
    });
    function writeJson(retry) {
      var out = mergeInto(state.json);
      return putFile(C.file, b64enc(JSON.stringify(out, null, 2) + '\n'), state.sha, 'Edit site content').then(function (r) {
        state.json = out; state.sha = r.content.sha;
      }, function (err) {
        if (retry && (err.code === 409 || err.code === 422)) return loadRemote().then(function () { return writeJson(false); });
        throw err;
      });
    }
    chain.then(function () { return writeJson(true); }).then(function () {
      state.text = {}; state.vis = {}; state.photos = {}; state.settings = {}; pending = {};
      $$('.ed-changed').forEach(function (n) { n.classList.remove('ed-changed'); });
      setDirty(false); say('Saved. Your live site updates in about a minute.');
    }).catch(function (err) {
      btnSave.disabled = false;
      if (err && err.code === 'auth') { showLogin('Your login expired. Log in again, then press Save.'); say('Please log in again.', true); }
      else if (err && err.code === 403 || err && err.code === 404) say('GitHub says this login cannot change the repository (' + err.code + '). Log in with the account that owns it.', true);
      else say('Could not save: ' + ((err && err.message) || 'unknown error') + '. Try again.', true);
    });
  }
  btnSave.addEventListener('click', save);
  document.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (!btnSave.disabled) save(); } });

  // ---------- start ----------
  function start() {
    if (!getToken()) { say('Log in to start editing.'); showLogin(); return; }
    say('Loading your content…');
    loadRemote().then(function () {
      applyRemote(); buildPanel(); layoutPhotoUI(); state.ready = true;
      say('Click any text to edit it. Press Save when you are done.');
      setTimeout(layoutPhotoUI, 600);
    }).catch(function (err) {
      if (err && err.code === 'auth') { showLogin('Please log in again.'); return; }
      if (err && (err.code === 404 || err.code === 403)) { setToken(null); showLogin('This GitHub account cannot open the site repository. Log in with the account that owns it.'); return; }
      say('Could not load your content: ' + ((err && err.message) || 'network problem') + '.', true);
    });
  }
  start();
})();
