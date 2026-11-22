// Builds taxila-marks.html (bookmark install page) from taxila-marks.js. Run: node build.js
const fs = require('fs');
require('./test.js'); // throws (and stops the build) if a rule broke
// The bookmark is a small loader that rarely changes: it runs the copy of taxila-marks.js saved in Taxila's localStorage,
// downloading it from GitHub only on first use (or after storage is cleared). Updates come via the panel's Update button.
// A saved copy that fails to start is deleted, so the next click downloads a fresh one.
const SRC = 'https://raw.githubusercontent.com/ashutosh486/taxila-marks/main/taxila-marks.js';
const loader = `(function(){var c;try{c=localStorage.getItem('tm-code')}catch(e){}
function run(t){try{(0,eval)(t)}catch(e){localStorage.removeItem('tm-code');alert('Taxila Marks failed to start: '+e.message+' Click the bookmark again.')}}
if(c)return run(c);
fetch('${SRC}',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(t){
if(location.origin==='https://taxila-aws.bits-pilani.ac.in')localStorage.setItem('tm-code',t);run(t)}).catch(function(e){alert('Taxila Marks could not load: '+e.message)})})();void 0`;
const url = 'javascript:' + encodeURIComponent(loader);
// encodeURIComponent leaves no " < > & so the URL is safe inside a double-quoted attribute and a textarea.
if (/["<>&]/.test(url)) throw new Error('unexpected character in bookmarklet URL');

fs.writeFileSync(__dirname + '/taxila-marks.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Taxila Marks</title>
<style>
  :root { --ink: #1c1c1a; --muted: #6b6b66; --line: #e4e3df; --soft: #f5f4f1; --bg: #fff; --accent: #1f7a4d; }
  @media (prefers-color-scheme: dark) {
    :root { --ink: #ecebe7; --muted: #a3a29c; --line: #3a3936; --soft: #262523; --bg: #1a1918; --accent: #5cc08d; }
  }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  main { max-width: 640px; margin: 0 auto; padding: 40px 16px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 32px 0 8px; }
  p, li { color: var(--muted); }
  .bm { display: inline-block; margin: 12px 0; padding: 10px 18px; border-radius: 10px; background: var(--accent); color: #fff; font-weight: 600; text-decoration: none; cursor: grab; }
  textarea { box-sizing: border-box; width: 100%; height: 90px; padding: 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--soft); color: var(--ink); font: 12px ui-monospace, Menlo, monospace; resize: vertical; }
  button { margin-top: 8px; padding: 8px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--soft); color: var(--ink); font: inherit; cursor: pointer; }
</style>
</head>
<body>
<main>
  <h1>Taxila Marks</h1>
  <p>Shows your marks, upcoming deadlines and submission status for every Taxila course in one overlay. It runs only on a Taxila page while you're logged in.</p>
  <p>It reads your own Taxila pages in your browser and sends nothing anywhere else. When a new version is out, the panel shows an Update button. Click it to update; you never need to reinstall the bookmark. It doesn't change anything on Taxila or submit anything.</p>

  <h2>Install</h2>
  <p>Drag this button onto your bookmarks bar (press Ctrl+Shift+B, or Cmd+Shift+B on a Mac, if the bar is hidden):</p>
  <a class="bm" href="${url}" onclick="alert('Drag this button to your bookmarks bar, then click it there while you are on Taxila.'); return false;">📊 Taxila Marks</a>

  <h2>Or paste it into a bookmark</h2>
  <p>Copy the code, then edit any bookmark and paste it into the URL field.</p>
  <textarea id="code" readonly>${url}</textarea>
  <button id="copy">Copy code</button>

  <h2>Use</h2>
  <ol>
    <li>Log in to Taxila and open any page there.</li>
    <li>Click the bookmark. Close the panel with the ✕ in the top-right corner. Links open in a new tab, so the panel stays open.</li>
  </ol>
</main>
<script>
  document.getElementById('copy').onclick = async function () {
    var t = document.getElementById('code');
    try { await navigator.clipboard.writeText(t.value); } catch (e) { t.select(); document.execCommand('copy'); }
    this.textContent = 'Copied';
  };
</script>
</body>
</html>
`);
console.log('wrote taxila-marks.html');
// Keep the README's copy-paste box identical to the install page's bookmark.
const readme = fs.readFileSync(__dirname + '/README.md', 'utf8');
const box = /<!-- bookmark -->[\s\S]*?<!-- \/bookmark -->/;
if (!box.test(readme)) throw new Error('README.md is missing its <!-- bookmark --> markers');
fs.writeFileSync(__dirname + '/README.md', readme.replace(box, () => '<!-- bookmark -->\n```\n' + url + '\n```\n<!-- /bookmark -->'));
console.log('updated README.md');
