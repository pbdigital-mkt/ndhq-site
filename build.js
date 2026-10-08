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

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.cpSync(path.join(root, 'admin'), path.join(dist, 'admin'), { recursive: true });
const imgs = path.join(root, 'content/images');
if (fs.existsSync(imgs)) fs.cpSync(imgs, path.join(dist, 'images'), { recursive: true });
fs.copyFileSync(path.join(root, 'favicon.svg'), path.join(dist, 'favicon.svg'));
console.log('Built dist/index.html');
