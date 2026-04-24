#!/usr/bin/env node
'use strict';

const { runModule } = require('../lib/stub-runner');

runModule(__filename).catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
