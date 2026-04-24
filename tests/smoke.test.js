const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

const htmlFixture = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Fixture Shop</title>
  <meta name="description" content="Fixture description">
  <meta property="og:title" content="Fixture Shop OG">
  <meta property="og:description" content="Fixture OG description">
  <link rel="canonical" href="http://127.0.0.1/canonical">
  <link rel="alternate" type="application/rss+xml" href="/feed.xml">
  <style>
    body { font-family: 'Inter', sans-serif; color: #112233; }
    .product-card { border: 1px solid #ccc; }
  </style>
  <script>window.__NEXT_DATA__ = {};</script>
  <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST"></script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Fixture Product"}</script>
</head>
<body>
  <main>
    <h1>Fixture Product</h1>
    <p>Email us at fixture@example.com or ping @fixtureteam.</p>
    <article class="product-card">
      <a href="/product/1">View product</a>
      <span class="price">$19.99</span>
    </article>
    <img src="/image.png" alt="Fixture image">
    <img src="/missing-alt.png">
    <video src="/movie.mp4"></video>
    <a href="/manual.pdf">Manual PDF</a>
    <a href="/api/products">Products API</a>
    <a href="https://twitter.com/fixtureteam">Twitter</a>
    <form id="login" method="post" action="/login">
      <input type="hidden" name="csrf_token" value="token-12345678">
      <label for="email">Email</label>
      <input id="email" name="email" type="email">
      <input name="password" type="password">
      <button type="submit">Sign in</button>
    </form>
  </main>
</body>
</html>`;

async function runNode(args, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...extra,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      try {
        assert.equal(
          code,
          0,
          `Command failed: node ${args.join(' ')}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        );
        resolve({ stdout, stderr, status: code });
      } catch (error) {
        reject(error);
      }
    });
  });
}

test('all scripts expose help successfully', async () => {
  const directories = ['core', 'analyzers', 'auth-helpers', 'exporters', 'integrations', 'monitors', 'scrapers', 'utils'];
  for (const directory of directories) {
      const entries = await fsp.readdir(path.join(repoRoot, directory));
      for (const file of entries.filter((entry) => entry.endsWith('.js'))) {
        await runNode([path.join(directory, file), '--help']);
      }
    }
  });

test('representative modules execute against a local fixture', async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'webarsenal-smoke-'));
  const requests = [];
  let toggle = false;

  const server = http.createServer(async (req, res) => {
    requests.push({ method: req.method, url: req.url });

    if (req.url === '/feed.xml') {
      res.setHeader('content-type', 'application/rss+xml');
      res.end(`<?xml version="1.0"?><rss version="2.0"><channel><item><title>Fixture Feed</title><link>http://127.0.0.1/item</link></item></channel></rss>`);
      return;
    }

    if (req.url === '/manual.pdf') {
      res.setHeader('content-type', 'application/pdf');
      res.end('pdf');
      return;
    }

    if (req.url === '/hook' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        requests.push({ method: 'POST_BODY', body });
        res.statusCode = 200;
        res.end('ok');
      });
      return;
    }

    if (req.url === '/changing') {
      toggle = !toggle;
      res.setHeader('content-type', 'text/html');
      res.end(`<html><body>${toggle ? 'first' : 'second'}</body></html>`);
      return;
    }

    res.setHeader('content-type', 'text/html');
    res.end(htmlFixture);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const spaOutput = path.join(tempDir, 'spa.json');
    await runNode(['scrapers/spa-scraper.js', '--url', baseUrl, '--output', spaOutput]);
    const spa = JSON.parse(await fsp.readFile(spaOutput, 'utf8'));
    assert.equal(spa.summary.title, 'Fixture Shop');

    const seoOutput = path.join(tempDir, 'seo.json');
    await runNode(['analyzers/seo-auditor.js', '--url', baseUrl, '--output', seoOutput]);
    const seo = JSON.parse(await fsp.readFile(seoOutput, 'utf8'));
    assert.equal(seo.title, 'Fixture Shop');

    const csrfOutput = path.join(tempDir, 'csrf.json');
    await runNode(['auth-helpers/csrf-token-miner.js', '--url', baseUrl, '--output', csrfOutput]);
    const csrf = JSON.parse(await fsp.readFile(csrfOutput, 'utf8'));
    assert.ok(csrf.tokens.elements.length > 0);

    const jsonInput = path.join(tempDir, 'records.json');
    await fsp.writeFile(jsonInput, JSON.stringify([{ title: 'One', url: `${baseUrl}/one` }], null, 2));
    const csvOutput = path.join(tempDir, 'records.csv');
    await runNode(['exporters/to-csv.js', '--input', jsonInput, '--output', csvOutput]);
    const csv = await fsp.readFile(csvOutput, 'utf8');
    assert.match(csv, /title,url/);

    const sqliteOutput = path.join(tempDir, 'records.sqlite');
    await runNode(['exporters/to-sqlite.js', '--input', jsonInput, '--output', sqliteOutput]);
    assert.ok(fs.existsSync(sqliteOutput));

    const slackOutput = path.join(tempDir, 'slack.json');
    await runNode([
      'integrations/slack-alerter.js',
      '--message',
      'hello from test',
      '--webhook',
      `${baseUrl}/hook`,
      '--output',
      slackOutput,
    ]);
    const slack = JSON.parse(await fsp.readFile(slackOutput, 'utf8'));
    assert.equal(slack.delivered, true);

    const changeOutput = path.join(tempDir, 'change.json');
    const snapshotPath = path.join(tempDir, 'snapshot.json');
    await runNode(['monitors/change-detector.js', '--url', `${baseUrl}/changing`, '--snapshot', snapshotPath, '--output', changeOutput]);
    await runNode(['monitors/change-detector.js', '--url', `${baseUrl}/changing`, '--snapshot', snapshotPath, '--output', changeOutput]);
    const change = JSON.parse(await fsp.readFile(changeOutput, 'utf8'));
    assert.equal(change.changed, true);

    const normalizeOutput = path.join(tempDir, 'normalize.json');
    await runNode(['utils/url-normalizer.js', '--url', `${baseUrl}//path?b=2&a=1#frag`, '--output', normalizeOutput]);
    const normalized = JSON.parse(await fsp.readFile(normalizeOutput, 'utf8'));
    assert.match(normalized.normalizedUrl, /\?a=1&b=2$/);

    assert.ok(requests.some((entry) => entry.method === 'POST_BODY' && entry.body.includes('hello from test')));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
});
