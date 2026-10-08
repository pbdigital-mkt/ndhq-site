// Builds the static site: template.html + content/site.json -> dist/index.html
// No dependencies. Run with:  node build.js
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
for (const f of ['content/site.json', 'template.html', 'favicon.svg', 'admin']) {
  if (!fs.existsSync(path.join(root, f))) { console.error('Missing file or folder in the repository: ' + f + '. Upload it, keeping the same folder structure.'); process.exit(1); }
}
const site = JSON.parse(fs.readFileSync(path.join(root, 'content/site.json'), 'utf8'));
let html = fs.readFileSync(path.join(root, 'template.html'), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const flat = {};
for (const group of Object.values(site)) {
  if (group && typeof group === 'object') for (const [k, v] of Object.entries(group)) if (typeof v === 'string') flat[k] = v;
}

// hidden sections: remove the block and its menu link
const vis = site.visibility || {};
html = html.replace(/<!--(SEC|NAV):(\w+)-->([\s\S]*?)<!--\/\1-->/g, (m, kind, name, inner) => (vis[name] === false ? '' : inner));

// photo slots: an uploaded photo replaces the generated picture
const photos = site.photos || {};
html = html.replace(/<!--SLOT:(\w+)-->([\s\S]*?)<!--\/SLOT-->/g, (m, name, original) => {
  const p = photos[name];
  if (!p || !p.image) return original;
  const img = `<img class="${name === 'about' ? '' : 'case-photo'}" src="${esc(p.image)}" alt="${esc(p.alt || '')}" loading="lazy">`;
  return name === 'about' ? `<figure class="portrait">${img}</figure>` : img;
});

let missing = 0;
html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => {
  if (k in flat) return esc(flat[k]);
  missing++;
  return '';
});
if (missing) console.warn(`Warning: ${missing} placeholder(s) had no value in content/site.json`);

// ---- visual editor page: /edit/ (click text on the real page, saves through GitHub) ----
function buildEditPage(tpl) {
  const cfg = fs.readFileSync(path.join(root, 'admin/config.yml'), 'utf8');
  const pick = (re, d) => { const m = cfg.match(re); return m ? m[1].replace(/['"]/g, '') : d; };
  const conf = {
    repo: pick(/^\s*repo:\s*(\S+)/m, ''),
    branch: pick(/^\s*branch:\s*(\S+)/m, 'main'),
    helper: pick(/^\s*base_url:\s*(\S+)/m, '').replace(/\/+$/, ''),
    file: 'content/site.json',
    imgDir: pick(/^media_folder:\s*(\S+)/m, 'content/images'),
    publicDir: pick(/^public_folder:\s*(\S+)/m, '/images'),
  };
  const first = (inner, attr) => inner.replace(/<([a-zA-Z][\w-]*)/, '<$1 ' + attr);
  let h = tpl;
  const origins = [];
  h = h.replace(/<!--(SEC|NAV):(\w+)-->([\s\S]*?)<!--\/\1-->/g, (m, kind, name, inner) =>
    first(inner, kind === 'SEC' ? `data-sec="${name}"` : `data-nav="${name}"`));
  h = h.replace(/<!--SLOT:(\w+)-->([\s\S]*?)<!--\/SLOT-->/g, (m, name, original) => {
    origins.push(`<template id="orig-${name}">${original}</template>`);
    const p = (site.photos || {})[name];
    const alt = esc((p && p.alt) || '');
    if (p && p.image) {
      const img = `<img class="${name === 'about' ? '' : 'case-photo'}" src="${esc(p.image)}" alt="${alt}" data-slot="${name}">`;
      return name === 'about' ? `<figure class="portrait" data-slot="about">${img.replace(' data-slot="about"', '')}</figure>` : img;
    }
    if (name === 'about') return '<figure class="portrait ed-empty" data-slot="about"><span>No portrait yet. Click Add photo.</span></figure>';
    return first(original, `data-slot="${name}"`);
  });
  const bi = h.indexOf('<body');
  let head = h.slice(0, bi), body = h.slice(bi);
  head = head.replace(/\{\{(\w+)\}\}/g, (m, k) => esc(flat[k] || ''));
  body = body.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/).map((seg, i) => {
    if (i % 2) return seg;
    return seg.replace(/(<[^>]*>)|\{\{(\w+)\}\}/g, (m, tag, k) => {
      if (tag) return tag.replace(/\{\{(\w+)\}\}/g, (mm, kk) => esc(flat[kk] || ''));
      return `<span class="ed-t" data-k="${k}" spellcheck="false">${esc(flat[k] || '')}</span>`;
    });
  }).join('');
  head = head.replace('<head>', '<head>\n<meta name="robots" content="noindex">').replace(/<title>[\s\S]*?<\/title>/, '<title>Edit | NDHQ</title>');
  body = body.replace('</body>', origins.join('\n') + `\n<script>window.NDHQ_EDIT=${JSON.stringify(conf).replace(/</g, '\\u003c')};</script>\n<script src="/edit/edit.js"></script>\n</body>`);
  return head + body;
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.cpSync(path.join(root, 'admin'), path.join(dist, 'admin'), { recursive: true });
const imgs = path.join(root, 'content/images');
if (fs.existsSync(imgs)) fs.cpSync(imgs, path.join(dist, 'images'), { recursive: true });
if (fs.existsSync(path.join(root, 'edit.js'))) {
  fs.mkdirSync(path.join(dist, 'edit'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'edit/index.html'), buildEditPage(fs.readFileSync(path.join(root, 'template.html'), 'utf8')));
  fs.copyFileSync(path.join(root, 'edit.js'), path.join(dist, 'edit/edit.js'));
  console.log('Built dist/edit/index.html');
} else console.warn('edit.js not found in the repository: the visual editor page was skipped.');
fs.copyFileSync(path.join(root, 'favicon.svg'), path.join(dist, 'favicon.svg'));
console.log('Built dist/index.html');
