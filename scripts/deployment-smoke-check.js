#!/usr/bin/env node

const DEFAULT_API_BASE_URL = 'https://inventrack-api-v2l8.onrender.com';
const DEFAULT_FRONTEND_URL = 'https://inventrack.vercel.app';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Inventrack deployment smoke check\n\nUsage:\n  npm run smoke:deployment\n\nEnvironment variables:\n  API_BASE_URL       Backend base URL. Default: ${DEFAULT_API_BASE_URL}\n  FRONTEND_URL       Frontend base URL. Default: ${DEFAULT_FRONTEND_URL}\n  SMOKE_TIMEOUT_MS   Per-request timeout. Default: 15000\n\nThe command exits non-zero if any required deployment check fails.`);
  process.exit(0);
}

const apiBaseUrl = trimTrailingSlash(process.env.API_BASE_URL || DEFAULT_API_BASE_URL);
const frontendUrl = trimTrailingSlash(process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL);
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

const checks = [
  {
    name: 'API v2 health',
    url: `${apiBaseUrl}/api/v2/health`,
    kind: 'json',
    validate: (body) => {
      if (!body || body.status !== 'OK') {
        return `expected status OK, received ${JSON.stringify(body)}`;
      }
      if (body.postgres && body.postgres.configured === true && body.postgres.status !== 'connected') {
        return `PostgreSQL is configured but not connected: ${JSON.stringify(body.postgres)}`;
      }
      return null;
    }
  },
  {
    name: 'Dashboard shell',
    url: `${frontendUrl}/`,
    kind: 'html'
  },
  {
    name: 'Shipment board route',
    url: `${frontendUrl}/shipments`,
    kind: 'html'
  },
  {
    name: 'Receive workflow route',
    url: `${frontendUrl}/receive`,
    kind: 'html'
  },
  {
    name: 'Export workflow route',
    url: `${frontendUrl}/export`,
    kind: 'html'
  },
  {
    name: 'Movement history route',
    url: `${frontendUrl}/movements`,
    kind: 'html'
  },
  {
    name: 'Shipments API read model',
    url: `${apiBaseUrl}/api/v2/shipments`,
    kind: 'json'
  },
  {
    name: 'Inventory API read model',
    url: `${apiBaseUrl}/api/v2/inventory`,
    kind: 'json'
  },
  {
    name: 'Movements API read model',
    url: `${apiBaseUrl}/api/v2/stock-movements?limit=10`,
    kind: 'json'
  }
];

async function run() {
  console.log('Inventrack deployment smoke check');
  console.log(`Frontend: ${frontendUrl}`);
  console.log(`API:      ${apiBaseUrl}`);
  console.log('');

  const failures = [];

  for (const check of checks) {
    try {
      const result = await runCheck(check);
      console.log(`PASS ${check.name} (${result.status})`);
    } catch (error) {
      failures.push({ check, error });
      console.error(`FAIL ${check.name}: ${error.message}`);
    }
  }

  console.log('');
  if (failures.length > 0) {
    console.error(`${failures.length} deployment smoke check(s) failed.`);
    process.exit(1);
  }

  console.log('All deployment smoke checks passed.');
}

async function runCheck(check) {
  const response = await fetch(check.url, {
    headers: {
      Accept: check.kind === 'html' ? 'text/html,application/xhtml+xml' : 'application/json',
      'X-Demo-Role': 'viewer',
      'X-Request-Id': `smoke_${Date.now()}`
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const text = await safeText(response);
    throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 300)}` : ''}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (check.kind === 'html') {
    const html = await response.text();
    if (!contentType.includes('text/html') && !html.includes('<!doctype html') && !html.includes('<div id="root"')) {
      throw new Error(`expected frontend HTML shell, received content-type ${contentType || 'unknown'}`);
    }
    return { status: response.status };
  }

  const body = await response.json();
  if (check.validate) {
    const validationError = check.validate(body);
    if (validationError) {
      throw new Error(validationError);
    }
  }

  return { status: response.status };
}

async function safeText(response) {
  try {
    return await response.text();
  } catch (_error) {
    return '';
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
