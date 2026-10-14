// Inlines the sources into one self-contained page: dist/index.html.
// That folder is what gets deployed (Vercel serves it as a static site).
//   node build.js                     build dist/index.html
//   node build.js --artifact <file>   also write the page without the document wrapper (for a claude.ai Artifact)
'use strict';
const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const scripts = ['engine.js', 'levels.js', 'sprites.js', 'game.js']
  .map((f) => `<script>\n${src(f).replace(/<\/script/gi, '<\\/script')}\n</script>`)
  .join('\n');
const body = src('shell.html').replace('<!--SCRIPTS-->', () => scripts);

const description = 'Dig through a jungle temple, collect diamonds and dodge falling boulders. A free browser puzzle-adventure with 8 levels.';
const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Crect width='16' height='16' rx='3' fill='%230c1410'/%3E%3Cpath d='M4 3h8l3 3-7 8-7-8z' fill='%236fdcec'/%3E%3Cpath d='M4 3h4v3H1z' fill='%23bdf6ff'/%3E%3Cpath d='M8 6h7l-7 8z' fill='%232a8fa8'/%3E%3C/svg%3E";

const split = body.indexOf('<div class="app"');
const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${description}">
<meta name="theme-color" content="#0c1410">
<meta property="og:title" content="Diamond Hunter">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<link rel="icon" href="${favicon}">
<!-- Vercel Web Analytics: the script is served by Vercel once Analytics is enabled for the project -->
<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
${body.slice(0, split)}</head>
<body>
${body.slice(split)}</body>
</html>
`;

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), full);
console.log(`built dist/index.html (${(full.length / 1024).toFixed(1)} KB)`);

const ai = process.argv.indexOf('--artifact');
if (ai > 0 && process.argv[ai + 1]) {
  fs.writeFileSync(process.argv[ai + 1], body);
  console.log(`wrote ${process.argv[ai + 1]}`);
}
