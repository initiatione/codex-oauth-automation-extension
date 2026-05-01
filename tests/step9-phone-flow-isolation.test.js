const assert = require('assert');
const fs = require('fs');
const test = require('node:test');

const backgroundSource = fs.readFileSync('background.js', 'utf8');

function extractFunction(source, name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

const api = new Function(`
const PHONE_FLOW_STALE_ERROR_PREFIX = 'PHONE_FLOW_STALE::';
const LOG_PREFIX = '[test]';
let autoRunSessionId = 101;
let stopRequested = false;
let currentState = {
  autoRunSessionId,
  oauthUrl: 'https://auth.openai.com/oauth/authorize?old=1',
};
const logs = [];
let step9PhoneFlowTokenSeed = 0;
let activeStep9PhoneFlowToken = null;
let lastStaleStep9PhoneFlowLogKey = '';

function normalizeAutoRunSessionId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function throwIfStopped() {
  if (stopRequested) {
    throw new Error('Flow stopped.');
  }
}

async function getState() {
  return { ...currentState };
}

async function addLog(message, level = 'info') {
  logs.push({ message, level });
}

${extractFunction(backgroundSource, 'normalizeStep9PhoneFlowToken')}
${extractFunction(backgroundSource, 'createStep9PhoneFlowToken')}
${extractFunction(backgroundSource, 'invalidateStep9PhoneFlow')}
${extractFunction(backgroundSource, 'logStaleStep9PhoneFlow')}
${extractFunction(backgroundSource, 'assertStep9PhoneFlowCurrent')}

function resetStateForFreshAttempt() {
  invalidateStep9PhoneFlow('test fresh attempt reset');
  autoRunSessionId = 202;
  currentState = {
    autoRunSessionId,
    oauthUrl: 'https://auth.openai.com/oauth/authorize?new=1',
  };
}

return {
  createStep9PhoneFlowToken,
  assertStep9PhoneFlowCurrent,
  resetStateForFreshAttempt,
  setOAuthUrl: (oauthUrl) => {
    currentState = { ...currentState, oauthUrl };
  },
  snapshot: () => ({ logs: [...logs] }),
};
`)();

test('fresh auto-run attempt invalidates outstanding Step 9 phone-flow ownership', async () => {
  const token = await api.createStep9PhoneFlowToken({
    visibleStep: 9,
    oauthUrl: 'https://auth.openai.com/oauth/authorize?old=1',
    signupTabId: 88,
  });

  await api.assertStep9PhoneFlowCurrent({
    phoneFlowToken: token,
    actionLabel: 'before reset',
  });

  api.resetStateForFreshAttempt();

  await assert.rejects(
    api.assertStep9PhoneFlowCurrent({
      phoneFlowToken: token,
      actionLabel: 'HeroSMS getStatus',
    }),
    /PHONE_FLOW_STALE::Step 9 phone flow is stale before HeroSMS getStatus/
  );

  assert.ok(
    api.snapshot().logs.some(({ message }) => /旧 Step 9 接码任务已失效.*HeroSMS getStatus/.test(message)),
    'expected stale Step 9 diagnostic log'
  );
});

test('OAuth URL change makes previous Step 9 phone-flow token stale', async () => {
  api.setOAuthUrl('https://auth.openai.com/oauth/authorize?old=1');
  const token = await api.createStep9PhoneFlowToken({
    visibleStep: 9,
    oauthUrl: 'https://auth.openai.com/oauth/authorize?old=1',
    signupTabId: 88,
  });

  await api.assertStep9PhoneFlowCurrent({
    phoneFlowToken: token,
    actionLabel: 'before oauth refresh',
  });

  api.setOAuthUrl('https://auth.openai.com/oauth/authorize?new=1');

  await assert.rejects(
    api.assertStep9PhoneFlowCurrent({
      phoneFlowToken: token,
      actionLabel: 'HeroSMS setStatus(3)',
    }),
    /PHONE_FLOW_STALE::Step 9 phone flow is stale before HeroSMS setStatus\(3\)/
  );
});
