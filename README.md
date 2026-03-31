# 🕷️ WebArsenal

**The Ultimate Web Scraping & Mirroring Toolkit (110 Scripts)**

![Version](https://img.shields.io/badge/version-v4.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

> The definitive, battle-hardened collection of exactly 110 advanced modules for cloning sites, bypassing auth, extracting granular data, pushing to cloud vectors, and orchestrating full-scale monitoring operations.

## 🚀 Setup & Installation

Follow these steps to get your WebArsenal operational:

### 1. Prerequisites
- **Node.js**: Ensure you have Node.js (v18+) installed. [Download here](https://nodejs.org/).
- **Git**: [Download here](https://git-scm.com/) if you haven't already.

### 2. Clone the Repository
```bash
git clone https://github.com/edwinnyandika/webarsenal.git
cd webarsenal
```

### 3. Install Dependencies
This will install all necessary engines (Puppeteer, Playwright, etc.):
```bash
npm install
```

### 4. Verify Installation
Run a help command to confirm everything is working:
```bash
node core/super-mirror.js --help
```

---

## Modules Framework

### 1. `core/` (Heavy-Duty Mirrors)
High-performance monolithic scripts to recursively download entire sites.
- To execute: `node core/super-mirror.js --url https://example.com --depth 4`
- To execute (Playwright): `node core/grab-playwright.js --url https://example.com --pdf`

### 2. `scrapers/` (Targeted Data Extraction)
Scripts for granular operations.
- **SPA React/Vue scraper**: `node scrapers/spa-scraper.js --url https://example.com --wait-for '#app'`
- **E-commerce prices**: `node scrapers/ecommerce-scraper.js --url https://store.com`

### 3. `analyzers/` (DOM & SEO Security)
Heavy DOM tree analysis tools.
- **SEO Audit**: `node analyzers/seo-auditor.js --url <URL>`
- **Unused CSS**: `node analyzers/unused-css.js --url <URL>`

### 4. `auth-helpers/` (Bypasses & Tokens)
Get past walls.
- **Cloudflare Bypass**: `node auth-helpers/cf-clearance-puller.js --url <URL>`
- **Cookie Cloner**: `node auth-helpers/cookie-cloner.js --profile C:\Chrome\Profile`

### 5. `exporters/` (Data Shifting & Translation)
Shift formats effortlessly.
- **JSON to SQLite**: `node exporters/to-sqlite.js --input data.json`
- **Full Archive WARC**: `node exporters/to-warc.js --dir ./mirrored`

### 6. `integrations/` (Cloud Hooks)
Push straight to the database or cloud.
- **Airtable Sink**: `node integrations/airtable-sync.js --input records.json --token XYZ`
- **AWS S3 Push**: `node integrations/aws-s3-uploader.js --dir site_data/ --bucket my-scrape-bucket`

### 7. `monitors/` (Jobs & Tracking)
Persistent jobs for monitoring.
- **Change Detector**: `node monitors/change-detector.js --url <URL> --xpath "//div[@class='price']"`
- **Discord Webhook**: `node monitors/discord-webhook.js --webhook <URL>`

### 8. `utils/` (Core Tools)
Infrastructure mechanics.
- **Proxy Rotator**: `node utils/proxy-rotator.js --list proxies.txt`

## Quickstart Playbook: Combined Orchestration
To execute complex workflows, chain these scripts together sequentially. For example, a scheduled Cloudflare-protected E-commerce scrape to S3:

```bash
1. node auth-helpers/cf-clearance-puller.js --url https://store.com
2. node core/super-mirror.js --url https://store.com --depth 3 --cookie-jar cf_cookies.json
3. node integrations/aws-s3-uploader.js --dir ./super-mirrored-site --bucket website-backups
4. node integrations/slack-alerter.js --webhook https://hooks.slack.com/services/XYZ --message "Backup Success"
```