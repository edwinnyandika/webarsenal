#!/usr/bin/env node
'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');
const { URL } = require('url');
const { performance } = require('perf_hooks');
const { Command } = require('commander');
const cheerio = require('cheerio');
const chalk = require('chalk');

const VERSION = '4.1.0';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_LIMIT = 25;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

const TRACKER_PATTERNS = [
  'googletagmanager.com',
  'google-analytics.com',
  'doubleclick.net',
  'hotjar.com',
  'clarity.ms',
  'facebook.net',
  'connect.facebook.net',
  'segment.com',
  'cdn.segment.com',
  'mixpanel.com',
  'sentry.io',
  'newrelic.com',
];

const SOCIAL_HOSTS = [
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
  'github.com',
];

async function runModule(fileName) {
  const meta = getModuleMeta(fileName);
  const program = new Command();
  program
    .name(path.basename(fileName))
    .description(meta.description)
    .version(VERSION);

  addOptions(program, meta);
  program.parse(process.argv);

  const opts = normalizeOptions(program.opts());
  const result = await executeModule(meta, opts);
  await emitResult(meta, opts, result);
  return result;
}

function getModuleMeta(fileName) {
  const category = path.basename(path.dirname(fileName));
  const name = path.basename(fileName, '.js');
  return {
    category,
    name,
    label: `${category}/${name}`,
    description: buildDescription(category, name),
  };
}

function buildDescription(category, name) {
  const explicit = {
    'analyzers/a11y-checker': 'Run lightweight accessibility checks against a page or HTML file.',
    'analyzers/color-palette-extractor': 'Extract color tokens and CSS color usage from a page.',
    'analyzers/dead-link-spider': 'Discover page links and validate their HTTP status codes.',
    'analyzers/dom-diff': 'Compare two HTML snapshots and summarize the DOM changes.',
    'analyzers/email-spider': 'Collect email addresses and mailto links from a page.',
    'analyzers/html5-validator': 'Run structural HTML validation heuristics on a page.',
    'analyzers/malware-scanner': 'Scan HTML and script references for suspicious indicators.',
    'analyzers/payload-size-analyzer': 'Measure response size and asset payload distribution.',
    'analyzers/readability-scorer': 'Estimate content readability from visible page text.',
    'analyzers/seo-auditor': 'Audit SEO signals such as title, description, canonical, and headings.',
    'analyzers/tech-fingerprinter': 'Fingerprint common frameworks and front-end technologies.',
    'analyzers/tracker-radar': 'Detect common analytics and tracking vendors in the markup.',
    'analyzers/typography-analyzer': 'Extract and summarize font-family usage from a page.',
    'analyzers/unused-css': 'Estimate unused CSS selectors by comparing selectors to the DOM.',
    'analyzers/xss-fuzzer': 'Probe a URL parameter for basic reflected-XSS behavior.',
    'auth-helpers/basic-auth': 'Fetch a protected URL using HTTP Basic Authentication.',
    'auth-helpers/cf-clearance-puller': 'Inspect response cookies and challenge signals for Cloudflare targets.',
    'auth-helpers/cookie-cloner': 'Normalize a cookie file into a reusable cookie jar.',
    'auth-helpers/csrf-token-miner': 'Find CSRF tokens in forms, scripts, and meta tags.',
    'auth-helpers/jwt-extractor': 'Decode JWTs from input text, cookies, or an explicit token.',
    'auth-helpers/oauth-grabber': 'Discover OAuth-related links, parameters, and forms.',
    'auth-helpers/session-keepalive': 'Send repeated requests to keep a session warm and log results.',
    'auth-helpers/totp-generator': 'Generate a TOTP code from a shared secret.',
    'auth-helpers/user-agent-spoofer': 'Pick or rotate browser user-agents for downstream requests.',
    'exporters/diff-reporter': 'Compare two files and write a concise diff report.',
    'exporters/feed-builder': 'Build an RSS feed from JSON records.',
    'exporters/html-cleaner': 'Remove comments, scripts, and excess whitespace from HTML.',
    'exporters/image-optimizer': 'Inspect local images and report optimization candidates.',
    'exporters/link-graph-viz': 'Convert discovered links into a Graphviz DOT graph.',
    'exporters/schema-extractor': 'Extract JSON-LD and microdata-like snippets from HTML.',
    'exporters/text-extractor': 'Extract visible text from HTML or a live URL.',
    'exporters/to-csv': 'Convert JSON records into CSV output.',
    'exporters/to-har': 'Wrap a fetch result in a minimal HAR-like JSON document.',
    'exporters/to-json': 'Normalize source data into structured JSON.',
    'exporters/to-markdown': 'Convert JSON records into Markdown output.',
    'exporters/to-pdf': 'Render a URL or HTML file into PDF using Puppeteer.',
    'exporters/to-sqlite': 'Store JSON records in a SQLite database using sql.js.',
    'exporters/to-warc': 'Create a minimal WARC response record from input content.',
    'exporters/to-zip': 'Package a file or directory into a ZIP archive.',
    'integrations/discord-webhook': 'Send a JSON payload or message to a Discord webhook.',
    'integrations/slack-alerter': 'Send a JSON payload or message to a Slack-compatible webhook.',
    'integrations/zapier-webhook': 'POST a payload to a Zapier webhook endpoint.',
    'monitors/archive-pusher': 'Archive files or snapshots into a ZIP bundle.',
    'monitors/change-detector': 'Track content hashes between runs and report drift.',
    'monitors/content-watcher': 'Watch page content for changes and store snapshots locally.',
    'monitors/header-inspector': 'Capture response headers and caching metadata.',
    'monitors/keyword-watcher': 'Check whether a keyword is present and how often it appears.',
    'monitors/link-checker': 'Validate links discovered on a page.',
    'monitors/perf-auditor': 'Measure fetch time and payload size for a target URL.',
    'monitors/price-tracker': 'Extract price-like text and compare it to a previous snapshot.',
    'monitors/redirect-tracer': 'Trace HTTP redirects step by step.',
    'monitors/screenshot-diff': 'Capture page screenshots and compare them against the last run.',
    'monitors/session-logger': 'Log status, cookies, and response details for a target.',
    'monitors/ssl-checker': 'Inspect certificate validity dates and subject names.',
    'monitors/uptime-monitor': 'Report availability, status code, and response timing.',
    'monitors/webhook-notifier': 'Send monitor results to a generic webhook endpoint.',
    'scrapers/api-scraper': 'Extract likely API endpoints from markup and scripts.',
    'scrapers/ecommerce-scraper': 'Extract product-like cards, links, and prices from a page.',
    'scrapers/form-mapper': 'Map forms, fields, actions, and methods from a page.',
    'scrapers/image-scraper': 'Extract image URLs from a page.',
    'scrapers/link-harvester': 'Collect and normalize links from a page.',
    'scrapers/pdf-scraper': 'Find PDF assets linked from a page.',
    'scrapers/rss-scraper': 'Parse RSS/Atom feeds or discover linked feeds from a page.',
    'scrapers/social-scraper': 'Extract social profile links and handles from a page.',
    'scrapers/video-scraper': 'Extract video assets and embeds from a page.',
    'utils/cookie-jar': 'Normalize cookie input into a reusable JSON cookie jar.',
    'utils/css-rewriter': 'Rewrite relative CSS asset URLs against a new base URL.',
    'utils/html-rewriter': 'Rewrite HTML links and asset URLs against a new base URL.',
    'utils/link-extractor': 'Extract and normalize links from HTML or a URL.',
    'utils/mime-sniffer': 'Guess MIME type from a file path or a live URL response.',
    'utils/progress-ui': 'Render a compact progress report for JSON array input.',
    'utils/proxy-rotator': 'Rotate through a list of proxy strings and emit a plan.',
    'utils/queue-manager': 'Normalize queue items from input into a runnable queue manifest.',
    'utils/rate-limiter': 'Generate a simple throttling plan for a script or URL list.',
    'utils/report-gen': 'Generate a Markdown report from JSON input.',
    'utils/robot-parser': 'Fetch and parse robots.txt rules.',
    'utils/sitemap-gen': 'Build a sitemap.xml document from discovered URLs.',
    'utils/url-normalizer': 'Normalize URL ordering, casing, and duplicate slashes.',
  };

  const key = `${category}/${name}`;
  if (explicit[key]) {
    return explicit[key];
  }

  const pretty = name.split('-').map(capitalize).join(' ');
  switch (category) {
    case 'scrapers':
      return `Fetch a target and extract ${pretty.toLowerCase()} signals as structured JSON.`;
    case 'analyzers':
      return `Inspect a target and report ${pretty.toLowerCase()} findings.`;
    case 'auth-helpers':
      return `Run the ${pretty.toLowerCase()} authentication helper workflow.`;
    case 'exporters':
      return `Transform input data with the ${pretty.toLowerCase()} exporter.`;
    case 'integrations':
      return `Prepare or deliver a payload using the ${pretty.toLowerCase()} integration.`;
    case 'monitors':
      return `Run the ${pretty.toLowerCase()} monitoring workflow.`;
    case 'utils':
      return `Run the ${pretty.toLowerCase()} utility.`;
    default:
      return `Run ${pretty}.`;
  }
}

function addOptions(program, meta) {
  addCommonOptions(program);

  switch (meta.category) {
    case 'scrapers':
    case 'analyzers':
      addUrlOptions(program);
      program.option('--param <name>', 'Query parameter to probe.');
      program.option('--keyword <text>', 'Keyword to search for.');
      break;
    case 'auth-helpers':
      addUrlOptions(program);
      addAuthOptions(program);
      break;
    case 'exporters':
      addUrlOptions(program);
      addFileOptions(program);
      program.option('--title <text>', 'Document or feed title.');
      program.option('--name <value>', 'Record or table name.');
      break;
    case 'integrations':
      addFileOptions(program);
      program.option('-u, --url <url>', 'Optional source URL to load before sending.');
      program.option('--webhook <url>', 'Webhook URL.');
      program.option('--endpoint <url>', 'Generic service endpoint URL.');
      program.option('--token <token>', 'Bearer token or service token.');
      program.option('--base <id>', 'Base or project identifier.');
      program.option('--database <id>', 'Database identifier.');
      program.option('--table <name>', 'Table or collection name.');
      program.option('--bucket <name>', 'Bucket or queue name.');
      program.option('--message <text>', 'Message body for alert-style integrations.');
      program.option('--dry-run', 'Skip outbound network calls and only emit payload.');
      break;
    case 'monitors':
      addUrlOptions(program);
      addFileOptions(program);
      program.option('--snapshot <file>', 'Snapshot file path.', 'monitor-snapshot.json');
      program.option('--keyword <text>', 'Keyword to watch for.');
      program.option('--threshold <num>', 'Change threshold.', parseInteger, 0);
      break;
    case 'utils':
      addUrlOptions(program);
      addFileOptions(program);
      program.option('--list <file>', 'List file path.');
      program.option('--rpm <num>', 'Requests per minute.', parseInteger, 60);
      program.option('--script <file>', 'Script path for plan generation.');
      break;
    default:
      break;
  }
}

function addCommonOptions(program) {
  program.option('-o, --output <file>', 'Write output to a file.');
  program.option('--limit <num>', 'Maximum items to return.', parseInteger, DEFAULT_LIMIT);
  program.option('--timeout <ms>', 'Network timeout in milliseconds.', parseInteger, DEFAULT_TIMEOUT);
  program.option('--pretty', 'Pretty-print the result.');
  program.option('--format <type>', 'Preferred output format.');
}

function addUrlOptions(program) {
  program.option('-u, --url <url>', 'Target URL.');
  program.option('--selector <css>', 'CSS selector to focus extraction.');
  program.option('--user-agent <ua>', 'Custom User-Agent header.');
}

function addFileOptions(program) {
  program.option('-i, --input <file>', 'Input file path.');
  program.option('--baseline <file>', 'Baseline file path for comparisons.');
  program.option('--dir <path>', 'Directory path.');
}

function addAuthOptions(program) {
  program.option('--username <value>', 'Username.');
  program.option('--password <value>', 'Password.');
  program.option('--token <token>', 'Token or API key.');
  program.option('--secret <value>', 'Shared secret.');
  program.option('--cookie-file <file>', 'Cookie file path.');
  program.option('--interval <ms>', 'Interval in milliseconds.', parseInteger, 1000);
  program.option('--count <num>', 'Number of iterations.', parseInteger, 3);
  program.option('--site-key <key>', 'Captcha site key.');
}

function normalizeOptions(opts) {
  return {
    ...opts,
    limit: opts.limit || DEFAULT_LIMIT,
    timeout: opts.timeout || DEFAULT_TIMEOUT,
    pretty: Boolean(opts.pretty),
  };
}

async function executeModule(meta, opts) {
  switch (meta.category) {
    case 'scrapers':
      return executeScraper(meta, opts);
    case 'analyzers':
      return executeAnalyzer(meta, opts);
    case 'auth-helpers':
      return executeAuthHelper(meta, opts);
    case 'exporters':
      return executeExporter(meta, opts);
    case 'integrations':
      return executeIntegration(meta, opts);
    case 'monitors':
      return executeMonitor(meta, opts);
    case 'utils':
      return executeUtility(meta, opts);
    default:
      return { ok: true, message: `No handler for ${meta.label}.` };
  }
}

async function executeScraper(meta, opts) {
  const page = await loadPageState(opts);
  const links = collectLinks(page.$, page.finalUrl);
  const assets = collectAssets(page.$, page.finalUrl);
  const forms = collectForms(page.$, page.finalUrl);
  const visibleText = extractVisibleText(page.$);

  switch (meta.name) {
    case 'link-harvester':
      return withPage(meta, page, {
        links: links.slice(0, opts.limit),
        totalLinks: links.length,
      });
    case 'image-scraper':
      return withPage(meta, page, {
        images: assets.images.slice(0, opts.limit),
        totalImages: assets.images.length,
      });
    case 'video-scraper':
      return withPage(meta, page, {
        videos: assets.videos.slice(0, opts.limit),
        embeds: assets.embeds.slice(0, opts.limit),
      });
    case 'pdf-scraper':
      return withPage(meta, page, {
        pdfs: links.filter((link) => /\.pdf(?:$|\?)/i.test(link.url)).slice(0, opts.limit),
      });
    case 'form-mapper':
      return withPage(meta, page, {
        forms,
        totalForms: forms.length,
      });
    case 'api-scraper':
      return withPage(meta, page, {
        endpoints: detectApiEndpoints(page.text, links).slice(0, opts.limit),
      });
    case 'rss-scraper':
      return handleFeedScrape(meta, opts, page);
    case 'social-scraper':
      return withPage(meta, page, {
        socialLinks: links.filter((link) => hasAnyHost(link.url, SOCIAL_HOSTS)).slice(0, opts.limit),
        handles: extractSocialHandles(visibleText).slice(0, opts.limit),
      });
    case 'ecommerce-scraper':
      return withPage(meta, page, {
        products: extractProductCards(page.$, page.finalUrl, opts.selector).slice(0, opts.limit),
      });
    case 'headless-recorder':
      return withPage(meta, page, {
        summary: buildPageSummary(page.$, page.finalUrl, page),
        assets,
      });
    default:
      return withPage(meta, page, {
        summary: buildPageSummary(page.$, page.finalUrl, page),
        links: links.slice(0, Math.min(opts.limit, 10)),
        forms: forms.slice(0, 5),
      });
  }
}

async function executeAnalyzer(meta, opts) {
  if (meta.name === 'dom-diff') {
    return handleDomDiff(opts);
  }

  const page = await loadPageState(opts);
  const links = collectLinks(page.$, page.finalUrl);
  const summary = buildPageSummary(page.$, page.finalUrl, page);

  switch (meta.name) {
    case 'seo-auditor':
      return withPage(meta, page, buildSeoAudit(page.$));
    case 'dead-link-spider':
      return withPage(meta, page, {
        checked: await inspectLinks(links.slice(0, opts.limit), opts.timeout),
      });
    case 'email-spider':
      return withPage(meta, page, {
        emails: extractEmails(page.text).slice(0, opts.limit),
      });
    case 'html5-validator':
      return withPage(meta, page, buildHtmlValidation(page.$));
    case 'readability-scorer':
      return withPage(meta, page, buildReadabilityReport(extractVisibleText(page.$)));
    case 'payload-size-analyzer':
      return withPage(meta, page, {
        responseBytes: page.buffer.length,
        responseKilobytes: round(page.buffer.length / 1024),
        assetCounts: collectAssets(page.$, page.finalUrl),
      });
    case 'tracker-radar':
      return withPage(meta, page, {
        trackers: detectTrackers(page.text, links),
      });
    case 'tech-fingerprinter':
      return withPage(meta, page, {
        technologies: fingerprintTechnologies(page.text, page.$),
      });
    case 'a11y-checker':
      return withPage(meta, page, buildAccessibilityReport(page.$));
    case 'color-palette-extractor':
      return withPage(meta, page, {
        colors: extractColors(page.text).slice(0, opts.limit),
      });
    case 'typography-analyzer':
      return withPage(meta, page, {
        fontFamilies: extractFontFamilies(page.text).slice(0, opts.limit),
      });
    case 'unused-css':
      return withPage(meta, page, estimateUnusedCss(page.$, page.text));
    case 'malware-scanner':
      return withPage(meta, page, {
        indicators: detectMalwareIndicators(page.text, links),
      });
    case 'xss-fuzzer':
      return await executeXssProbe(meta, opts);
    default:
      return withPage(meta, page, { summary });
  }
}

async function executeAuthHelper(meta, opts) {
  switch (meta.name) {
    case 'basic-auth':
      requireOptions(opts, ['url', 'username', 'password']);
      return executeBasicAuth(opts);
    case 'cookie-cloner':
      requireOptions(opts, ['cookieFile']);
      return normalizeCookieFile(opts.cookieFile);
    case 'csrf-token-miner': {
      const page = await loadPageState(opts);
      return withPage(meta, page, {
        tokens: extractCsrfTokens(page.$, page.text),
      });
    }
    case 'jwt-extractor':
      return executeJwtExtract(opts);
    case 'oauth-grabber': {
      const page = await loadPageState(opts);
      return withPage(meta, page, {
        hints: extractOauthHints(page.$, page.text, page.finalUrl),
      });
    }
    case 'session-keepalive':
      requireOptions(opts, ['url']);
      return keepSessionAlive(opts);
    case 'totp-generator':
      requireOptions(opts, ['secret']);
      return {
        ok: true,
        code: generateTotp(opts.secret),
        generatedAt: new Date().toISOString(),
      };
    case 'user-agent-spoofer':
      return executeUserAgentSpoofer(opts);
    case 'cf-clearance-puller': {
      const page = await loadPageState(opts);
      return withPage(meta, page, {
        cookies: headerToList(page.headers['set-cookie']),
        cloudflareSignals: detectCloudflareSignals(page.text, page.headers),
      });
    }
    case 'headless-login-bot': {
      const page = await loadPageState(opts);
      return withPage(meta, page, {
        forms: collectForms(page.$, page.finalUrl),
        likelyLogin: detectLikelyLoginForms(page.$),
      });
    }
    case 'proxy-auth-tester':
      return {
        ok: true,
        supported: false,
        message: 'Proxy connectivity testing is not available without an HTTP agent dependency. This module now validates configuration and emits a reusable plan.',
        proxy: opts.input || opts.url || null,
      };
    case '2captcha-auto':
    case 'hcaptcha-solver':
      return {
        ok: true,
        supported: false,
        message: 'External captcha solving requires provider credentials and a live challenge. This module now validates inputs and emits a request payload skeleton.',
        request: {
          provider: meta.name,
          siteKey: opts.siteKey || null,
          pageUrl: opts.url || null,
          tokenPresent: Boolean(opts.token),
        },
      };
    case 'canvas-defender':
    case 'tls-fingerprint-randomizer':
      return {
        ok: true,
        profile: buildBrowserProfile(meta.name),
      };
    default:
      return {
        ok: true,
        message: `${meta.name} is now executable and returns a configuration report.`,
        options: opts,
      };
  }
}

async function executeExporter(meta, opts) {
  switch (meta.name) {
    case 'to-pdf':
      requireAnyOption(opts, ['url', 'input']);
      return renderToPdf(meta, opts);
    case 'to-zip':
      requireAnyOption(opts, ['input', 'dir']);
      return zipPath(meta, opts);
    case 'to-sqlite':
      requireOptions(opts, ['input']);
      return exportToSqlite(meta, opts);
    case 'to-csv':
      requireOptions(opts, ['input']);
      return convertJsonToCsv(meta, opts);
    case 'to-markdown':
      requireOptions(opts, ['input']);
      return convertJsonToMarkdown(meta, opts);
    case 'to-json':
      requireAnyOption(opts, ['input', 'url']);
      return convertToJson(meta, opts);
    case 'text-extractor':
      requireAnyOption(opts, ['input', 'url']);
      return extractTextArtifact(meta, opts);
    case 'html-cleaner':
      requireAnyOption(opts, ['input', 'url']);
      return cleanHtmlArtifact(meta, opts);
    case 'schema-extractor':
      requireAnyOption(opts, ['input', 'url']);
      return extractSchemaArtifact(meta, opts);
    case 'diff-reporter':
      requireOptions(opts, ['input', 'baseline']);
      return diffArtifacts(meta, opts);
    case 'feed-builder':
      requireOptions(opts, ['input']);
      return buildFeedArtifact(meta, opts);
    case 'link-graph-viz':
      requireAnyOption(opts, ['input', 'url']);
      return buildLinkGraph(meta, opts);
    case 'to-har':
      requireAnyOption(opts, ['input', 'url']);
      return buildHar(meta, opts);
    case 'to-warc':
      requireAnyOption(opts, ['input', 'url']);
      return buildWarc(meta, opts);
    case 'image-optimizer':
      requireOptions(opts, ['input']);
      return inspectImage(meta, opts);
    default:
      return {
        ok: true,
        message: `${meta.name} executed with baseline export behavior.`,
        options: opts,
      };
  }
}

async function executeIntegration(meta, opts) {
  const payload = await buildOutboundPayload(meta, opts);
  const service = meta.name;
  const directWebhookServices = new Set(['slack-alerter', 'discord-webhook', 'zapier-webhook', 'webhook-notifier']);

  if (directWebhookServices.has(service)) {
    requireAnyOption(opts, ['webhook', 'endpoint']);
    return sendWebhook(meta, opts, payload);
  }

  if (opts.dryRun || !opts.endpoint && !opts.webhook) {
    return {
      ok: true,
      delivered: false,
      service,
      payload,
      message: 'Dry-run completed. Provide --endpoint/--webhook for direct delivery when supported.',
    };
  }

  if (service === 'elastic-ingester') {
    return postJson(opts.endpoint, payload, opts.token, { service });
  }

  return {
    ok: true,
    delivered: false,
    service,
    payload,
    message: `${service} now validates inputs and prepares a payload, but direct delivery is only wired for webhook and REST-first integrations.`,
  };
}

async function executeMonitor(meta, opts) {
  switch (meta.name) {
    case 'change-detector':
    case 'content-watcher':
      requireOptions(opts, ['url']);
      return detectChanges(meta, opts);
    case 'header-inspector':
      requireOptions(opts, ['url']);
      return inspectHeaders(meta, opts);
    case 'keyword-watcher':
      requireOptions(opts, ['url', 'keyword']);
      return watchKeyword(meta, opts);
    case 'link-checker': {
      const page = await loadPageState(opts);
      const links = collectLinks(page.$, page.finalUrl);
      return withPage(meta, page, {
        checked: await inspectLinks(links.slice(0, opts.limit), opts.timeout),
      });
    }
    case 'perf-auditor':
      requireOptions(opts, ['url']);
      return measurePerformance(meta, opts);
    case 'price-tracker':
      requireOptions(opts, ['url']);
      return trackPrice(meta, opts);
    case 'redirect-tracer':
      requireOptions(opts, ['url']);
      return traceRedirects(meta, opts);
    case 'screenshot-diff':
      requireOptions(opts, ['url']);
      return compareScreenshots(meta, opts);
    case 'session-logger':
      requireOptions(opts, ['url']);
      return logSession(meta, opts);
    case 'ssl-checker':
      requireOptions(opts, ['url']);
      return inspectSsl(meta, opts);
    case 'uptime-monitor':
      requireOptions(opts, ['url']);
      return measureAvailability(meta, opts);
    case 'webhook-notifier':
      requireAnyOption(opts, ['webhook', 'endpoint']);
      return sendWebhook(meta, opts, { message: opts.message || 'Monitor notification from WebArsenal.' });
    case 'archive-pusher':
      requireAnyOption(opts, ['input', 'dir']);
      return zipPath(meta, opts);
    default:
      return {
        ok: true,
        message: `${meta.name} executed with baseline monitoring behavior.`,
        options: opts,
      };
  }
}

async function executeUtility(meta, opts) {
  switch (meta.name) {
    case 'url-normalizer':
      requireOptions(opts, ['url']);
      return {
        ok: true,
        normalizedUrl: normalizeUrl(opts.url),
      };
    case 'link-extractor': {
      const page = await loadPageState(opts);
      return withPage(meta, page, {
        links: collectLinks(page.$, page.finalUrl).slice(0, opts.limit),
      });
    }
    case 'mime-sniffer':
      return sniffMime(meta, opts);
    case 'report-gen':
      requireOptions(opts, ['input']);
      return generateMarkdownReport(meta, opts);
    case 'robot-parser':
      requireOptions(opts, ['url']);
      return parseRobots(meta, opts);
    case 'sitemap-gen':
      requireAnyOption(opts, ['input', 'url']);
      return generateSitemap(meta, opts);
    case 'html-rewriter':
      requireAnyOption(opts, ['input', 'url']);
      return rewriteHtml(meta, opts);
    case 'css-rewriter':
      requireAnyOption(opts, ['input', 'url']);
      return rewriteCss(meta, opts);
    case 'cookie-jar':
      requireOptions(opts, ['input']);
      return normalizeCookieFile(opts.input);
    case 'proxy-rotator':
      requireAnyOption(opts, ['list', 'input']);
      return rotateProxies(meta, opts);
    case 'queue-manager':
      requireOptions(opts, ['input']);
      return buildQueue(meta, opts);
    case 'rate-limiter':
      return buildRateLimitPlan(meta, opts);
    case 'progress-ui':
      requireOptions(opts, ['input']);
      return summarizeProgress(meta, opts);
    case 'stealth-browser':
      return {
        ok: true,
        launchArgs: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
        userAgent: USER_AGENTS[0],
      };
    default:
      return {
        ok: true,
        message: `${meta.name} executed with baseline utility behavior.`,
        options: opts,
      };
  }
}
async function loadPageState(opts) {
  requireOptions(opts, ['url']);
  const response = await fetchResource(opts.url, opts);
  const html = response.text;
  const $ = cheerio.load(html);
  return {
    ...response,
    $,
  };
}

async function fetchResource(url, opts = {}) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), opts.timeout || DEFAULT_TIMEOUT);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': opts.userAgent || USER_AGENTS[0],
        accept: '*/*',
      },
      redirect: opts.redirect || 'follow',
      signal: controller.signal,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const durationMs = round(performance.now() - startedAt);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      buffer,
      text: buffer.toString('utf8'),
      finalUrl: response.url,
      durationMs,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function withPage(meta, page, payload) {
  return {
    ok: true,
    module: meta.name,
    source: page.finalUrl,
    status: page.status,
    durationMs: page.durationMs,
    ...payload,
  };
}

function buildPageSummary($, finalUrl, page) {
  return {
    url: finalUrl,
    title: $('title').first().text().trim() || null,
    description: $('meta[name="description"]').attr('content') || null,
    h1: $('h1').first().text().trim() || null,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    wordCount: countWords(extractVisibleText($)),
    linkCount: $('a[href]').length,
    imageCount: $('img[src]').length,
    scriptCount: $('script[src]').length,
    sizeBytes: page.buffer.length,
  };
}

function buildSeoAudit($) {
  const title = $('title').first().text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const headings = [];
  ['h1', 'h2', 'h3'].forEach((tag) => {
    $(tag).each((_, node) => {
      headings.push({ tag, text: $(node).text().trim() });
    });
  });

  return {
    title,
    titleLength: title.length,
    metaDescription: description,
    metaDescriptionLength: description.length,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    robots: $('meta[name="robots"]').attr('content') || null,
    openGraph: {
      title: $('meta[property="og:title"]').attr('content') || null,
      description: $('meta[property="og:description"]').attr('content') || null,
      image: $('meta[property="og:image"]').attr('content') || null,
    },
    headings,
    schemaCount: $('script[type="application/ld+json"]').length,
    missing: {
      title: !title,
      description: !description,
      h1: $('h1').length === 0,
      canonical: !$('link[rel="canonical"]').length,
    },
  };
}

function buildHtmlValidation($) {
  const doctypePresent = /^\s*<!doctype html>/i.test($.html() || '');
  const htmlLang = $('html').attr('lang') || null;
  const duplicateIds = findDuplicateIds($);
  return {
    doctypePresent,
    htmlLang,
    metaCharsetPresent: $('meta[charset]').length > 0,
    titlePresent: Boolean($('title').first().text().trim()),
    duplicateIds,
    missingAltCount: $('img').filter((_, node) => !$(node).attr('alt')).length,
  };
}

function buildReadabilityReport(text) {
  const words = countWords(text);
  const sentences = Math.max(text.split(/[.!?]+/).filter(Boolean).length, 1);
  const syllables = estimateSyllables(text);
  const score = round(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / Math.max(words, 1)));
  return {
    words,
    sentences,
    syllables,
    fleschReadingEase: score,
  };
}

function buildAccessibilityReport($) {
  const imagesMissingAlt = $('img').filter((_, node) => !$(node).attr('alt')).map((_, node) => $(node).attr('src') || null).get();
  const unlabeledInputs = $('input, textarea, select').filter((_, node) => {
    const id = $(node).attr('id');
    const ariaLabel = $(node).attr('aria-label');
    const ariaLabelledBy = $(node).attr('aria-labelledby');
    const hasLabel = id ? $(`label[for="${cssEscape(id)}"]`).length > 0 : false;
    return !ariaLabel && !ariaLabelledBy && !hasLabel;
  }).map((_, node) => ({
    tag: node.tagName,
    name: $(node).attr('name') || null,
    type: $(node).attr('type') || null,
  })).get();

  return {
    imagesMissingAlt,
    unlabeledInputs,
    duplicateIds: findDuplicateIds($),
    missingMainLandmark: $('main').length === 0,
    headingOrder: $('h1,h2,h3,h4,h5,h6').map((_, node) => node.tagName).get(),
  };
}

function estimateUnusedCss($, htmlText) {
  const classNames = new Set();
  $('[class]').each((_, node) => {
    const value = $(node).attr('class') || '';
    value.split(/\s+/).filter(Boolean).forEach((entry) => classNames.add(entry));
  });

  const selectors = unique((htmlText.match(/\.([A-Za-z0-9_-]+)/g) || []).map((match) => match.slice(1)));
  const matched = selectors.filter((selector) => classNames.has(selector));
  const unused = selectors.filter((selector) => !classNames.has(selector));

  return {
    discoveredClassSelectors: selectors.length,
    matchedSelectors: matched.slice(0, 50),
    potentiallyUnusedSelectors: unused.slice(0, 50),
  };
}

async function executeXssProbe(meta, opts) {
  requireOptions(opts, ['url']);
  const paramName = opts.param || 'q';
  const probe = 'wa_xss_probe_12345';
  const target = new URL(opts.url);
  target.searchParams.set(paramName, probe);
  const response = await fetchResource(target.href, opts);
  return {
    ok: true,
    module: meta.name,
    target: target.href,
    reflected: response.text.includes(probe),
    reflectedCount: countOccurrences(response.text, probe),
  };
}

async function executeBasicAuth(opts) {
  const credentials = Buffer.from(`${opts.username}:${opts.password}`).toString('base64');
  const response = await fetch(opts.url, {
    headers: {
      authorization: `Basic ${credentials}`,
      'user-agent': opts.userAgent || USER_AGENTS[0],
    },
  });

  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

async function keepSessionAlive(opts) {
  const runs = [];
  for (let index = 0; index < opts.count; index += 1) {
    const response = await fetchResource(opts.url, opts);
    runs.push({
      iteration: index + 1,
      status: response.status,
      durationMs: response.durationMs,
    });
    if (index < opts.count - 1) {
      await sleep(opts.interval);
    }
  }

  return {
    ok: true,
    runs,
  };
}

function executeUserAgentSpoofer(opts) {
  const agents = USER_AGENTS.map((entry, index) => ({ index: index + 1, userAgent: entry }));
  return {
    ok: true,
    selected: opts.userAgent || USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    pool: agents,
  };
}

async function executeJwtExtract(opts) {
  let raw = opts.token || null;
  if (!raw && opts.input) {
    raw = await fsp.readFile(path.resolve(opts.input), 'utf8');
  }

  if (!raw) {
    throw new Error('Provide --token or --input to decode JWT data.');
  }

  const token = findJwt(raw);
  if (!token) {
    throw new Error('No JWT-like token was found in the provided input.');
  }

  const [header, payload] = token.split('.').slice(0, 2).map((segment) => decodeJwtSection(segment));
  return {
    ok: true,
    token,
    header,
    payload,
  };
}

async function convertJsonToCsv(meta, opts) {
  const records = await loadJsonRecords(opts.input);
  const csv = toCsv(records);
  return {
    ok: true,
    rows: records.length,
    artifact: {
      format: 'csv',
      content: csv,
      suggestedExtension: '.csv',
    },
  };
}

async function convertJsonToMarkdown(meta, opts) {
  const records = await loadJsonRecords(opts.input);
  const markdown = toMarkdown(records);
  return {
    ok: true,
    rows: records.length,
    artifact: {
      format: 'markdown',
      content: markdown,
      suggestedExtension: '.md',
    },
  };
}

async function convertToJson(meta, opts) {
  if (opts.input) {
    const value = await loadInput(opts.input);
    return {
      ok: true,
      normalized: value,
    };
  }

  const page = await loadPageState(opts);
  return withPage(meta, page, {
    summary: buildPageSummary(page.$, page.finalUrl, page),
    links: collectLinks(page.$, page.finalUrl).slice(0, opts.limit),
  });
}

async function extractTextArtifact(meta, opts) {
  const value = await loadHtmlSource(opts);
  const text = extractVisibleText(value.$);
  return {
    ok: true,
    wordCount: countWords(text),
    artifact: {
      format: 'text',
      content: text,
      suggestedExtension: '.txt',
    },
  };
}

async function cleanHtmlArtifact(meta, opts) {
  const value = await loadHtmlSource(opts);
  value.$('script,noscript').remove();
  const cleaned = value.$.html().replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n');
  return {
    ok: true,
    artifact: {
      format: 'html',
      content: cleaned,
      suggestedExtension: '.html',
    },
  };
}

async function extractSchemaArtifact(meta, opts) {
  const value = await loadHtmlSource(opts);
  const schemas = value.$('script[type="application/ld+json"]').map((_, node) => {
    const text = value.$(node).text().trim();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }).get();

  return {
    ok: true,
    schemaCount: schemas.length,
    schemas,
  };
}

async function diffArtifacts(meta, opts) {
  const left = await fsp.readFile(path.resolve(opts.input), 'utf8');
  const right = await fsp.readFile(path.resolve(opts.baseline), 'utf8');
  const summary = buildTextDiff(left, right);
  return {
    ok: true,
    ...summary,
    artifact: {
      format: 'markdown',
      content: renderDiffMarkdown(summary),
      suggestedExtension: '.md',
    },
  };
}

async function buildFeedArtifact(meta, opts) {
  const records = await loadJsonRecords(opts.input);
  const title = opts.title || 'WebArsenal Feed';
  const items = records.slice(0, opts.limit).map((record, index) => ({
    title: stringifyScalar(record.title || record.name || `Item ${index + 1}`),
    link: record.url || record.link || 'https://example.com',
    description: stringifyScalar(record.description || record.summary || record.text || ''),
  }));
  const xml = renderRss(title, items);
  return {
    ok: true,
    itemCount: items.length,
    artifact: {
      format: 'xml',
      content: xml,
      suggestedExtension: '.xml',
    },
  };
}

async function buildLinkGraph(meta, opts) {
  const links = opts.input
    ? await loadJsonRecords(opts.input)
    : collectLinks((await loadPageState(opts)).$, opts.url);
  const graph = renderDotGraph(Array.isArray(links) ? links : []);
  return {
    ok: true,
    artifact: {
      format: 'dot',
      content: graph,
      suggestedExtension: '.dot',
    },
  };
}

async function buildHar(meta, opts) {
  if (opts.input) {
    const value = await loadInput(opts.input);
    return {
      ok: true,
      log: {
        version: '1.2',
        creator: { name: 'WebArsenal', version: VERSION },
        entries: Array.isArray(value) ? value : [value],
      },
    };
  }

  const response = await fetchResource(opts.url, opts);
  return {
    ok: true,
    log: {
      version: '1.2',
      creator: { name: 'WebArsenal', version: VERSION },
      entries: [
        {
          request: { method: 'GET', url: opts.url },
          response: {
            status: response.status,
            headers: objectEntries(response.headers).map(([name, value]) => ({ name, value })),
            content: { size: response.buffer.length },
          },
          timings: { wait: response.durationMs },
        },
      ],
    },
  };
}

async function buildWarc(meta, opts) {
  const source = opts.input ? await fsp.readFile(path.resolve(opts.input)) : (await fetchResource(opts.url, opts)).buffer;
  const uri = opts.url || `file://${path.resolve(opts.input)}`;
  const warc = [
    'WARC/1.0',
    'WARC-Type: response',
    `WARC-Target-URI: ${uri}`,
    `WARC-Date: ${new Date().toISOString()}`,
    `Content-Length: ${source.length}`,
    '',
    source.toString('utf8'),
  ].join('\n');

  return {
    ok: true,
    artifact: {
      format: 'warc',
      content: warc,
      suggestedExtension: '.warc',
    },
  };
}

async function inspectImage(meta, opts) {
  const filePath = path.resolve(opts.input);
  const stats = await fsp.stat(filePath);
  return {
    ok: true,
    file: filePath,
    sizeBytes: stats.size,
    mimeType: guessMimeFromPath(filePath),
    recommendation: stats.size > 500000 ? 'Image is a good candidate for compression.' : 'Image size is already modest.',
  };
}

async function buildOutboundPayload(meta, opts) {
  let data = null;
  if (opts.input) {
    data = await loadInput(opts.input);
  } else if (opts.url) {
    data = await convertToJson(meta, opts);
  }

  return {
    service: meta.name,
    message: opts.message || `${meta.name} payload from WebArsenal`,
    data,
    timestamp: new Date().toISOString(),
    table: opts.table || null,
    database: opts.database || null,
    bucket: opts.bucket || null,
  };
}

async function sendWebhook(meta, opts, payload) {
  const endpoint = opts.webhook || opts.endpoint;
  if (opts.dryRun) {
    return {
      ok: true,
      delivered: false,
      endpoint,
      payload,
    };
  }

  return postJson(endpoint, payload, opts.token, { service: meta.name });
}

async function postJson(endpoint, payload, token, extra = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  return {
    ok: response.ok,
    delivered: response.ok,
    status: response.status,
    endpoint,
    ...extra,
  };
}

async function detectChanges(meta, opts) {
  const response = await fetchResource(opts.url, opts);
  const hash = sha256(response.buffer);
  const snapshotPath = path.resolve(opts.snapshot);
  let previous = null;

  if (fs.existsSync(snapshotPath)) {
    previous = JSON.parse(await fsp.readFile(snapshotPath, 'utf8'));
  }

  const next = {
    url: opts.url,
    hash,
    status: response.status,
    sizeBytes: response.buffer.length,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(snapshotPath, next);

  return {
    ok: true,
    changed: previous ? previous.hash !== hash : false,
    previous,
    current: next,
  };
}

async function inspectHeaders(meta, opts) {
  const response = await fetchResource(opts.url, opts);
  return {
    ok: true,
    status: response.status,
    headers: response.headers,
  };
}

async function watchKeyword(meta, opts) {
  const page = await loadPageState(opts);
  const count = countOccurrences(page.text.toLowerCase(), opts.keyword.toLowerCase());
  return withPage(meta, page, {
    keyword: opts.keyword,
    matches: count,
    present: count > 0,
  });
}

async function measurePerformance(meta, opts) {
  const response = await fetchResource(opts.url, opts);
  return {
    ok: true,
    url: response.finalUrl,
    status: response.status,
    durationMs: response.durationMs,
    sizeBytes: response.buffer.length,
  };
}

async function trackPrice(meta, opts) {
  const page = await loadPageState(opts);
  const prices = extractPrices(page.$, page.text);
  const snapshotPath = path.resolve(opts.snapshot);
  const previous = fs.existsSync(snapshotPath) ? JSON.parse(await fsp.readFile(snapshotPath, 'utf8')) : null;
  const current = {
    prices,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(snapshotPath, current);

  return withPage(meta, page, {
    prices,
    changed: previous ? JSON.stringify(previous.prices) !== JSON.stringify(prices) : false,
    previousPrices: previous ? previous.prices : null,
  });
}

async function traceRedirects(meta, opts) {
  const steps = [];
  let current = opts.url;

  for (let index = 0; index < 10; index += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': opts.userAgent || USER_AGENTS[0] },
    });
    const location = response.headers.get('location');
    steps.push({
      url: current,
      status: response.status,
      location,
    });
    if (!location || response.status < 300 || response.status >= 400) {
      break;
    }
    current = new URL(location, current).href;
  }

  return {
    ok: true,
    steps,
  };
}

async function compareScreenshots(meta, opts) {
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());

  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.goto(opts.url, { waitUntil: 'networkidle2', timeout: opts.timeout });
    const buffer = await page.screenshot({ fullPage: true });
    const hash = sha256(buffer);
    const snapshotPath = path.resolve(opts.snapshot);
    let previous = null;
    if (fs.existsSync(snapshotPath)) {
      previous = JSON.parse(await fsp.readFile(snapshotPath, 'utf8'));
    }
    const payload = { hash, sizeBytes: buffer.length, updatedAt: new Date().toISOString() };
    await writeJson(snapshotPath, payload);
    return {
      ok: true,
      changed: previous ? previous.hash !== hash : false,
      current: payload,
      previous,
    };
  } finally {
    await browser.close();
  }
}

async function logSession(meta, opts) {
  const response = await fetch(opts.url, {
    headers: { 'user-agent': opts.userAgent || USER_AGENTS[0] },
  });
  return {
    ok: true,
    status: response.status,
    cookies: headerToList(response.headers.get('set-cookie')),
    headers: Object.fromEntries(response.headers.entries()),
  };
}

async function inspectSsl(meta, opts) {
  const url = new URL(opts.url);
  const port = Number(url.port || 443);

  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: url.hostname,
      port,
      servername: url.hostname,
      rejectUnauthorized: false,
    }, () => {
      const cert = socket.getPeerCertificate();
      resolve({
        ok: true,
        issuer: cert.issuer || null,
        subject: cert.subject || null,
        validFrom: cert.valid_from || null,
        validTo: cert.valid_to || null,
        subjectAltName: cert.subjectaltname || null,
      });
      socket.end();
    });

    socket.on('error', reject);
  });
}

async function measureAvailability(meta, opts) {
  const response = await fetchResource(opts.url, opts);
  return {
    ok: response.status >= 200 && response.status < 400,
    status: response.status,
    durationMs: response.durationMs,
    finalUrl: response.finalUrl,
  };
}

async function sniffMime(meta, opts) {
  if (opts.input) {
    return {
      ok: true,
      source: path.resolve(opts.input),
      mimeType: guessMimeFromPath(opts.input),
    };
  }

  requireOptions(opts, ['url']);
  const response = await fetch(opts.url, { method: 'HEAD' });
  return {
    ok: response.ok,
    source: opts.url,
    mimeType: response.headers.get('content-type'),
  };
}

async function generateMarkdownReport(meta, opts) {
  const input = await loadInput(opts.input);
  const markdown = renderKeyValueMarkdown('Report', input);
  return {
    ok: true,
    artifact: {
      format: 'markdown',
      content: markdown,
      suggestedExtension: '.md',
    },
  };
}

async function parseRobots(meta, opts) {
  const robotsUrl = new URL('/robots.txt', opts.url).href;
  const response = await fetchResource(robotsUrl, opts);
  const lines = response.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const disallow = [];
  const allow = [];
  lines.forEach((line) => {
    const [key, value] = line.split(':').map((segment) => segment.trim());
    if (!value) {
      return;
    }
    if (/^disallow$/i.test(key)) {
      disallow.push(value);
    }
    if (/^allow$/i.test(key)) {
      allow.push(value);
    }
  });
  return {
    ok: true,
    robotsUrl,
    disallow,
    allow,
  };
}

async function generateSitemap(meta, opts) {
  const urls = await loadUrlList(opts);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
    '</urlset>',
  ].join('\n');

  return {
    ok: true,
    count: urls.length,
    artifact: {
      format: 'xml',
      content: xml,
      suggestedExtension: '.xml',
    },
  };
}

async function rewriteHtml(meta, opts) {
  const source = await loadHtmlSource(opts);
  source.$('[href],[src]').each((_, node) => {
    ['href', 'src'].forEach((attr) => {
      const value = source.$(node).attr(attr);
      if (!value || !opts.url) {
        return;
      }
      source.$(node).attr(attr, safeResolve(opts.url, value));
    });
  });
  return {
    ok: true,
    artifact: {
      format: 'html',
      content: source.$.html(),
      suggestedExtension: '.html',
    },
  };
}

async function rewriteCss(meta, opts) {
  const raw = await loadTextSource(opts);
  requireOptions(opts, ['url']);
  const rewritten = raw.content.replace(/url\((['"]?)([^'")]+)\1\)/gi, (_, quote, value) => {
    if (/^(data:|https?:|#|\/\/)/i.test(value)) {
      return `url(${quote}${value}${quote})`;
    }
    return `url(${quote}${safeResolve(opts.url, value)}${quote})`;
  });

  return {
    ok: true,
    artifact: {
      format: 'css',
      content: rewritten,
      suggestedExtension: '.css',
    },
  };
}

async function rotateProxies(meta, opts) {
  const sourcePath = path.resolve(opts.list || opts.input);
  const lines = (await fsp.readFile(sourcePath, 'utf8')).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const plan = lines.map((proxy, index) => ({
    order: index + 1,
    proxy,
  }));
  return {
    ok: true,
    plan,
  };
}

async function buildQueue(meta, opts) {
  const value = await loadInput(opts.input);
  const items = Array.isArray(value) ? value : [value];
  return {
    ok: true,
    queue: items.map((item, index) => ({
      id: index + 1,
      item,
      status: 'pending',
    })),
  };
}

function buildRateLimitPlan(meta, opts) {
  return {
    ok: true,
    rpm: opts.rpm,
    intervalMs: round(60000 / Math.max(opts.rpm, 1)),
    script: opts.script || null,
    target: opts.url || null,
  };
}

async function summarizeProgress(meta, opts) {
  const value = await loadInput(opts.input);
  const items = Array.isArray(value) ? value : [value];
  const completed = items.filter((item) => item.status === 'done' || item.done === true).length;
  return {
    ok: true,
    total: items.length,
    completed,
    remaining: items.length - completed,
    percent: items.length === 0 ? 0 : round((completed / items.length) * 100),
  };
}

async function renderToPdf(meta, opts) {
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());

  const browser = await puppeteer.launch({ headless: 'new' });
  const outputPath = path.resolve(opts.output || `${meta.name}.pdf`);

  try {
    const page = await browser.newPage();
    if (opts.url) {
      await page.goto(opts.url, { waitUntil: 'networkidle2', timeout: opts.timeout });
    } else {
      const html = await fsp.readFile(path.resolve(opts.input), 'utf8');
      await page.setContent(html, { waitUntil: 'networkidle0' });
    }
    ensureParent(outputPath);
    await page.pdf({ path: outputPath, printBackground: true, format: 'A4' });
    return {
      ok: true,
      outputPath,
      wroteDirectly: true,
    };
  } finally {
    await browser.close();
  }
}

async function zipPath(meta, opts) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  const sourcePath = path.resolve(opts.dir || opts.input);
  const outputPath = path.resolve(opts.output || `${path.basename(sourcePath)}.zip`);

  const stats = await fsp.stat(sourcePath);
  if (stats.isDirectory()) {
    zip.addLocalFolder(sourcePath);
  } else {
    zip.addLocalFile(sourcePath);
  }

  ensureParent(outputPath);
  zip.writeZip(outputPath);
  return {
    ok: true,
    outputPath,
    wroteDirectly: true,
  };
}

async function exportToSqlite(meta, opts) {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const records = await loadJsonRecords(opts.input);
  const outputPath = path.resolve(opts.output || `${path.basename(opts.input, path.extname(opts.input))}.sqlite`);
  const keys = unique(records.flatMap((record) => Object.keys(record)));
  db.run(`CREATE TABLE records (${keys.map((key) => `${safeIdentifier(key)} TEXT`).join(', ') || 'value TEXT'});`);

  if (keys.length === 0) {
    records.forEach((record) => {
      db.run('INSERT INTO records (value) VALUES (?);', [JSON.stringify(record)]);
    });
  } else {
    const placeholders = keys.map(() => '?').join(', ');
    const statement = db.prepare(`INSERT INTO records (${keys.map(safeIdentifier).join(', ')}) VALUES (${placeholders});`);
    records.forEach((record) => {
      statement.run(keys.map((key) => stringifyScalar(record[key])));
    });
    statement.free();
  }

  ensureParent(outputPath);
  await fsp.writeFile(outputPath, Buffer.from(db.export()));
  db.close();
  return {
    ok: true,
    rows: records.length,
    outputPath,
    wroteDirectly: true,
  };
}

async function emitResult(meta, opts, result) {
  const outputPath = opts.output ? path.resolve(opts.output) : null;

  if (result && result.wroteDirectly) {
    process.stdout.write(`${chalk.green('?')} ${meta.label} wrote ${outputPath || result.outputPath}\n`);
    return;
  }

  if (outputPath) {
    if (result && result.artifact) {
      ensureParent(outputPath);
      await fsp.writeFile(outputPath, result.artifact.content);
    } else {
      await writeJson(outputPath, result);
    }
    process.stdout.write(`${chalk.green('?')} ${meta.label} wrote ${outputPath}\n`);
    return;
  }

  if (result && result.artifact && typeof result.artifact.content === 'string' && result.artifact.format !== 'json') {
    process.stdout.write(`${result.artifact.content}\n`);
    return;
  }

  const payload = stripArtifact(result);
  process.stdout.write(`${JSON.stringify(payload, null, opts.pretty ? 2 : 2)}\n`);
}

function stripArtifact(result) {
  if (!result || !result.artifact) {
    return result;
  }

  return {
    ...result,
    artifact: {
      format: result.artifact.format,
      suggestedExtension: result.artifact.suggestedExtension || null,
      size: Buffer.byteLength(String(result.artifact.content)),
    },
  };
}

async function loadInput(inputPath) {
  const resolved = path.resolve(inputPath);
  const raw = await fsp.readFile(resolved, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function loadJsonRecords(inputPath) {
  const value = await loadInput(inputPath);
  if (Array.isArray(value)) {
    return value.map((entry) => (isPlainObject(entry) ? entry : { value: entry }));
  }
  if (isPlainObject(value)) {
    return [value];
  }
  return [{ value }];
}

async function loadHtmlSource(opts) {
  if (opts.input) {
    const content = await fsp.readFile(path.resolve(opts.input), 'utf8');
    return { content, $: cheerio.load(content) };
  }

  const page = await loadPageState(opts);
  return { content: page.text, $: page.$ };
}

async function loadTextSource(opts) {
  if (opts.input) {
    return { content: await fsp.readFile(path.resolve(opts.input), 'utf8') };
  }

  const response = await fetchResource(opts.url, opts);
  return { content: response.text };
}

async function loadUrlList(opts) {
  if (opts.input) {
    const value = await loadInput(opts.input);
    if (Array.isArray(value)) {
      return unique(value.map((entry) => typeof entry === 'string' ? entry : entry.url || entry.link).filter(Boolean));
    }
  }

  const page = await loadPageState(opts);
  return unique(collectLinks(page.$, page.finalUrl).map((link) => link.url));
}

function collectLinks($, baseUrl) {
  return unique($('a[href]').map((_, node) => {
    const href = $(node).attr('href');
    if (!href) {
      return null;
    }
    return JSON.stringify({
      text: $(node).text().trim() || null,
      url: safeResolve(baseUrl, href),
    });
  }).get().filter(Boolean)).map((value) => JSON.parse(value));
}

function collectAssets($, baseUrl) {
  const images = unique($('img[src]').map((_, node) => safeResolve(baseUrl, $(node).attr('src'))).get().filter(Boolean));
  const videos = unique($('video[src], video source[src]').map((_, node) => safeResolve(baseUrl, $(node).attr('src'))).get().filter(Boolean));
  const embeds = unique($('iframe[src], embed[src]').map((_, node) => safeResolve(baseUrl, $(node).attr('src'))).get().filter(Boolean));
  return {
    images,
    videos,
    embeds,
    scripts: unique($('script[src]').map((_, node) => safeResolve(baseUrl, $(node).attr('src'))).get().filter(Boolean)),
    stylesheets: unique($('link[rel="stylesheet"][href]').map((_, node) => safeResolve(baseUrl, $(node).attr('href'))).get().filter(Boolean)),
  };
}

function collectForms($, baseUrl) {
  return $('form').map((_, node) => ({
    action: safeResolve(baseUrl, $(node).attr('action') || baseUrl),
    method: ($(node).attr('method') || 'GET').toUpperCase(),
    id: $(node).attr('id') || null,
    fields: $(node).find('input, textarea, select').map((__, field) => ({
      tag: field.tagName,
      name: $(field).attr('name') || null,
      type: $(field).attr('type') || null,
      required: Boolean($(field).attr('required')),
    })).get(),
  })).get();
}

function detectApiEndpoints(text, links) {
  const fromText = unique((text.match(/https?:\/\/[^\s"'`<>]+/g) || []).filter((entry) => /\/api\/|graphql|rest|json/i.test(entry)));
  const fromPaths = unique((text.match(/["'`](\/[^"'`]*(?:api|graphql|rest)[^"'`]*)["'`]/gi) || []).map((entry) => entry.replace(/^["'`]|["'`]$/g, '')));
  const fromLinks = links.map((link) => link.url).filter((url) => /\/api\/|graphql|rest|json/i.test(url));
  return unique([...fromText, ...fromPaths, ...fromLinks]);
}

function extractSocialHandles(text) {
  return unique((text.match(/@[A-Za-z0-9_.-]{2,30}/g) || [])).slice(0, 50);
}

function extractProductCards($, baseUrl, selector) {
  const candidates = selector
    ? $(selector)
    : $('[itemtype*="Product"], [class*="product"], [data-product], article');

  return candidates.map((_, node) => {
    const element = $(node);
    const text = element.text().replace(/\s+/g, ' ').trim();
    const href = element.find('a[href]').first().attr('href');
    const price = (text.match(/[$€£]\s?\d[\d.,]*/g) || [])[0] || null;
    return {
      title: element.find('h1,h2,h3,h4,strong').first().text().trim() || text.slice(0, 120) || null,
      url: href ? safeResolve(baseUrl, href) : null,
      price,
      snippet: text.slice(0, 200),
    };
  }).get().filter((entry) => entry.title || entry.price || entry.url);
}

async function handleFeedScrape(meta, opts, page) {
  const contentType = (page.headers['content-type'] || '').toLowerCase();
  const xmlish = /xml|rss|atom/.test(contentType) || /^\s*<\?xml/i.test(page.text) || /^\s*<rss/i.test(page.text);
  if (xmlish) {
    const xml = cheerio.load(page.text, { xmlMode: true });
    const items = xml('item, entry').map((_, node) => ({
      title: xml(node).find('title').first().text().trim() || null,
      link: xml(node).find('link').attr('href') || xml(node).find('link').first().text().trim() || null,
      published: xml(node).find('pubDate, updated').first().text().trim() || null,
    })).get();
    return withPage(meta, page, {
      feedType: 'xml',
      items: items.slice(0, opts.limit),
    });
  }

  const links = collectLinks(page.$, page.finalUrl);
  const feeds = page.$('link[type*="rss"], link[type*="atom"]').map((_, node) => safeResolve(page.finalUrl, page.$(node).attr('href'))).get();
  return withPage(meta, page, {
    feedType: 'html',
    discoveredFeeds: unique([...feeds, ...links.filter((link) => /\.xml|rss|atom/i.test(link.url)).map((link) => link.url)]).slice(0, opts.limit),
  });
}

async function inspectLinks(links, timeout) {
  const results = [];
  for (const link of links) {
    try {
      const response = await fetch(link.url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(timeout) });
      results.push({
        url: link.url,
        status: response.status,
        ok: response.ok,
      });
    } catch (error) {
      results.push({
        url: link.url,
        ok: false,
        error: error.message,
      });
    }
  }
  return results;
}

function extractEmails(text) {
  return unique((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])).slice(0, 100);
}

function detectTrackers(text, links) {
  const haystack = `${text}\n${links.map((link) => link.url).join('\n')}`;
  return TRACKER_PATTERNS.filter((pattern) => haystack.includes(pattern));
}

function fingerprintTechnologies(text, $) {
  const rules = [
    ['React', /__NEXT_DATA__|react|_reactRootContainer/i],
    ['Vue', /__NUXT__|data-v-app|vue/i],
    ['Angular', /ng-version|angular/i],
    ['WordPress', /wp-content|wp-json|wordpress/i],
    ['jQuery', /jquery/i],
    ['Bootstrap', /bootstrap/i],
    ['Tailwind CSS', /tailwind/i],
  ];

  return rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function extractColors(text) {
  return unique(text.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6,8})\b|rgba?\([^)]*\)/g) || []);
}

function extractFontFamilies(text) {
  return unique((text.match(/font-family\s*:\s*([^;}{]+)/gi) || []).map((match) => match.split(':')[1].trim()));
}

function detectMalwareIndicators(text, links) {
  const indicators = [];
  const checks = [
    ['eval', /eval\s*\(/i],
    ['document.write', /document\.write\s*\(/i],
    ['fromCharCode', /fromCharCode/i],
    ['crypto miner strings', /coinhive|miner/i],
    ['obfuscated base64 blobs', /atob\s*\(|base64/i],
  ];

  checks.forEach(([label, pattern]) => {
    if (pattern.test(text)) {
      indicators.push(label);
    }
  });

  links.forEach((link) => {
    if (/bit\.ly|tinyurl|t\.co/i.test(link.url)) {
      indicators.push(`shortened-url:${link.url}`);
    }
  });

  return unique(indicators);
}

function extractCsrfTokens($, text) {
  const tokens = [];
  $('input[type="hidden"], meta').each((_, node) => {
    const element = $(node);
    const attrs = element.attr();
    const joined = JSON.stringify(attrs);
    if (/csrf|xsrf|authenticity/i.test(joined)) {
      tokens.push({
        tag: node.tagName,
        attrs,
      });
    }
  });

  const inline = unique(text.match(/(?:csrf|xsrf|authenticity)[A-Za-z0-9_-]*["':=\s]+([A-Za-z0-9._-]{8,})/gi) || []);
  return {
    elements: tokens,
    inlineMatches: inline,
  };
}

function extractOauthHints($, text, baseUrl) {
  const urls = collectLinks($, baseUrl).filter((link) => /oauth|authorize|token|openid|callback/i.test(link.url));
  const params = [];
  const seen = text.match(/client_id|redirect_uri|scope|response_type|code_challenge/gi) || [];
  seen.forEach((entry) => params.push(entry));
  return {
    urls: urls.slice(0, 50),
    parameters: unique(params),
  };
}

function detectCloudflareSignals(text, headers) {
  return {
    server: headers.server || null,
    cfRay: headers['cf-ray'] || null,
    challengeDetected: /cloudflare|cf-browser-verification|please enable cookies/i.test(text),
  };
}

function detectLikelyLoginForms($) {
  return $('form').filter((_, node) => {
    const fields = $(node).find('input[type="password"]').length;
    return fields > 0;
  }).map((_, node) => ({
    action: $(node).attr('action') || null,
    id: $(node).attr('id') || null,
    passwordFields: $(node).find('input[type="password"]').length,
  })).get();
}

async function handleDomDiff(opts) {
  requireOptions(opts, ['baseline']);
  const baseline = await fsp.readFile(path.resolve(opts.baseline), 'utf8');
  const current = opts.input
    ? await fsp.readFile(path.resolve(opts.input), 'utf8')
    : (await fetchResource(opts.url, opts)).text;

  const diff = buildTextDiff(baseline, current);
  return {
    ok: true,
    ...diff,
  };
}

async function normalizeCookieFile(inputPath) {
  const raw = await fsp.readFile(path.resolve(inputPath), 'utf8');
  let cookies;
  try {
    cookies = JSON.parse(raw);
  } catch {
    cookies = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name, value] = line.split('=');
      return { name, value };
    });
  }

  const normalized = Array.isArray(cookies) ? cookies.map((entry) => ({
    name: entry.name,
    value: entry.value,
    domain: entry.domain || null,
    path: entry.path || '/',
    secure: Boolean(entry.secure),
  })) : [];

  return {
    ok: true,
    cookies: normalized,
  };
}

function buildBrowserProfile(name) {
  return {
    name,
    viewport: { width: 1366, height: 900 },
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      dnt: '1',
    },
    webglNoise: true,
    canvasNoise: true,
  };
}

function toCsv(records) {
  const keys = unique(records.flatMap((record) => Object.keys(record)));
  const header = keys.join(',');
  const rows = records.map((record) => keys.map((key) => escapeCsv(stringifyScalar(record[key]))).join(','));
  return [header, ...rows].join('\n');
}

function toMarkdown(records) {
  const keys = unique(records.flatMap((record) => Object.keys(record)));
  if (keys.length === 0) {
    return '| value |\n| --- |\n';
  }
  const header = `| ${keys.join(' | ')} |`;
  const divider = `| ${keys.map(() => '---').join(' | ')} |`;
  const rows = records.map((record) => `| ${keys.map((key) => stringifyScalar(record[key]).replace(/\|/g, '\\|')).join(' | ')} |`);
  return [header, divider, ...rows].join('\n');
}

function buildTextDiff(left, right) {
  const leftLines = left.split(/\r?\n/);
  const rightLines = right.split(/\r?\n/);
  const max = Math.max(leftLines.length, rightLines.length);
  const changes = [];
  for (let index = 0; index < max; index += 1) {
    if (leftLines[index] !== rightLines[index]) {
      changes.push({
        line: index + 1,
        before: leftLines[index] || '',
        after: rightLines[index] || '',
      });
    }
    if (changes.length >= 50) {
      break;
    }
  }
  return {
    changed: changes.length > 0,
    changedLines: changes.length,
    beforeLines: leftLines.length,
    afterLines: rightLines.length,
    sample: changes,
  };
}

function renderDiffMarkdown(summary) {
  const lines = [
    '# Diff Report',
    '',
    `- Changed: ${summary.changed}`,
    `- Changed lines: ${summary.changedLines}`,
    '',
  ];

  summary.sample.forEach((entry) => {
    lines.push(`## Line ${entry.line}`);
    lines.push('');
    lines.push(`- Before: \`${entry.before.replace(/`/g, "'")}\``);
    lines.push(`- After: \`${entry.after.replace(/`/g, "'")}\``);
    lines.push('');
  });

  return lines.join('\n');
}

function renderRss(title, items) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"><channel>',
    `  <title>${escapeXml(title)}</title>`,
    ...items.map((item) => [
      '  <item>',
      `    <title>${escapeXml(item.title)}</title>`,
      `    <link>${escapeXml(item.link)}</link>`,
      `    <description>${escapeXml(item.description)}</description>`,
      '  </item>',
    ].join('\n')),
    '</channel></rss>',
  ].join('\n');
}

function renderDotGraph(links) {
  const edges = [];
  links.forEach((entry) => {
    if (entry.source && entry.target) {
      edges.push(`  "${entry.source}" -> "${entry.target}";`);
    } else if (entry.url) {
      edges.push(`  "root" -> "${entry.url}";`);
    }
  });
  return ['digraph Links {', ...edges, '}'].join('\n');
}

function renderKeyValueMarkdown(title, value) {
  const lines = [`# ${title}`, ''];
  objectEntries(value).forEach(([key, entry]) => {
    lines.push(`- **${key}**: ${stringifyScalar(entry)}`);
  });
  return lines.join('\n');
}

function extractVisibleText($) {
  const clone = cheerio.load($.html());
  clone('script,style,noscript').remove();
  return clone('body').text().replace(/\s+/g, ' ').trim();
}

function extractPrices($, text) {
  const matches = unique((text.match(/[$€£]\s?\d[\d.,]*/g) || [])).slice(0, 50);
  if (matches.length > 0) {
    return matches;
  }
  return unique($('*').map((_, node) => {
    const value = $(node).text().replace(/\s+/g, ' ').trim();
    return /[$€£]\s?\d[\d.,]*/.test(value) ? value.match(/[$€£]\s?\d[\d.,]*/)[0] : null;
  }).get().filter(Boolean)).slice(0, 50);
}

function findDuplicateIds($) {
  const counts = {};
  $('[id]').each((_, node) => {
    const id = $(node).attr('id');
    counts[id] = (counts[id] || 0) + 1;
  });
  return objectEntries(counts).filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
}

function findJwt(raw) {
  const match = raw.match(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return match ? match[0] : null;
}

function decodeJwtSection(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const decoded = Buffer.from(padded, 'base64').toString('utf8');
  try {
    return JSON.parse(decoded);
  } catch {
    return decoded;
  }
}

function generateTotp(secret) {
  const key = decodeBase32(secret.replace(/\s+/g, '').toUpperCase());
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

function decodeBase32(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of input) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      continue;
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function headerToList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return String(value).split(/,(?=[^;]+=[^;]+)/).map((entry) => entry.trim());
}

function hasAnyHost(urlValue, hosts) {
  try {
    const host = new URL(urlValue).hostname;
    return hosts.some((entry) => host === entry || host.endsWith(`.${entry}`));
  } catch {
    return false;
  }
}

function safeResolve(baseUrl, candidate) {
  try {
    return new URL(candidate, baseUrl).href;
  } catch {
    return candidate;
  }
}

function normalizeUrl(urlValue) {
  const parsed = new URL(urlValue);
  parsed.hash = '';
  parsed.searchParams.sort();
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/');
  return parsed.href;
}

function guessMimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.zip': 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

function countWords(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function estimateSyllables(text) {
  return (text.toLowerCase().match(/[aeiouy]{1,2}/g) || []).length;
}

function countOccurrences(text, term) {
  if (!text || !term) {
    return 0;
  }
  return text.split(term).length - 1;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sleep(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function unique(values) {
  return [...new Set(values)];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer: ${value}`);
  }
  return parsed;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stringifyScalar(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function escapeCsv(value) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cssEscape(value) {
  return String(value).replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~\\])/g, '\\$1');
}

function safeIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function writeJson(filePath, value) {
  ensureParent(filePath);
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2));
}

function objectEntries(value) {
  return Object.entries(isPlainObject(value) ? value : {});
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireOptions(opts, names) {
  const missing = names.filter((name) => opts[name] === undefined || opts[name] === null || opts[name] === '');
  if (missing.length > 0) {
    throw new Error(`Missing required option(s): ${missing.map((name) => `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`).join(', ')}`);
  }
}

function requireAnyOption(opts, names) {
  const present = names.some((name) => opts[name] !== undefined && opts[name] !== null && opts[name] !== '');
  if (!present) {
    throw new Error(`Provide at least one of: ${names.map((name) => `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`).join(', ')}`);
  }
}

module.exports = {
  runModule,
};
