#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const categories = [
  'analyzers',
  'auth-helpers',
  'exporters',
  'integrations',
  'monitors',
  'scrapers',
  'utils',
];

const wrapper = `#!/usr/bin/env node
'use strict';

const { runModule } = require('../lib/stub-runner');

runModule(__filename).catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
`;

async function main() {
  let updated = 0;

  for (const category of categories) {
    const dir = path.join(root, category);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) {
        continue;
      }
      const filePath = path.join(dir, entry.name);
      await fs.writeFile(filePath, wrapper, 'utf8');
      updated += 1;
    }
  }

  console.log(`Repaired ${updated} module wrappers.`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
