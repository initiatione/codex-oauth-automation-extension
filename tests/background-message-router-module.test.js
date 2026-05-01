const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

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

test('background imports message router module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/message-router\.js/);
});

test('message router module exposes a factory', () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

  assert.equal(typeof api?.createMessageRouter, 'function');
});

test('message router clears saved free reusable phone record', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  let clearCalls = 0;

  const router = api.createMessageRouter({
    clearFreeReusablePhoneActivation: async () => {
      clearCalls += 1;
      return { ok: true };
    },
  });

  const result = await router.handleMessage({ type: 'CLEAR_FREE_REUSABLE_PHONE' }, {});

  assert.deepStrictEqual(result, { ok: true });
  assert.equal(clearCalls, 1);
});

test('message router saves manual free reusable phone record', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const calls = [];

  const router = api.createMessageRouter({
    setFreeReusablePhoneActivation: async (payload) => {
      calls.push(payload);
      return { ok: true, freeReusablePhoneActivation: { phoneNumber: payload.phoneNumber } };
    },
  });

  const result = await router.handleMessage({
    type: 'SET_FREE_REUSABLE_PHONE',
    payload: { phoneNumber: '6281534591237' },
  }, {});

  assert.deepStrictEqual(result, {
    ok: true,
    freeReusablePhoneActivation: { phoneNumber: '6281534591237' },
  });
  assert.deepStrictEqual(calls, [{ phoneNumber: '6281534591237' }]);
});

test('background manual free reusable phone save resolves country label without sidepanel helpers', async () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const functionSource = extractFunction(source, 'setFreeReusablePhoneActivation');
  assert.doesNotMatch(functionSource, /getHeroSmsCountryLabelById/);

  const stateUpdates = [];
  const dataUpdates = [];
  const logs = [];
  const api = new Function('stateUpdates', 'dataUpdates', 'logs', `
const HERO_SMS_COUNTRY_ID = 52;
const HERO_SMS_COUNTRY_LABEL = 'Thailand';
const HERO_SMS_SERVICE_CODE = 'dr';
const DEFAULT_PHONE_NUMBER_MAX_USES = 3;
async function getState() {
  return {
    heroSmsCountryId: 6,
    heroSmsCountryLabel: 'Indonesia',
  };
}
async function setState(updates) {
  stateUpdates.push(updates);
}
function broadcastDataUpdate(updates) {
  dataUpdates.push(updates);
}
async function addLog(message, level) {
  logs.push({ message, level });
}
${functionSource}
return { setFreeReusablePhoneActivation };
`)(stateUpdates, dataUpdates, logs);

  const result = await api.setFreeReusablePhoneActivation({ phoneNumber: '6281534591237' });

  assert.equal(result.ok, true);
  assert.deepStrictEqual(result.freeReusablePhoneActivation, {
    phoneNumber: '6281534591237',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 6,
    countryLabel: 'Indonesia',
    successfulUses: 0,
    maxUses: 3,
    source: 'free-manual-reuse',
    recordedAt: result.freeReusablePhoneActivation.recordedAt,
    manualOnly: true,
  });
  assert.deepStrictEqual(stateUpdates, [{ freeReusablePhoneActivation: result.freeReusablePhoneActivation }]);
  assert.deepStrictEqual(dataUpdates, [{ freeReusablePhoneActivation: result.freeReusablePhoneActivation }]);
  assert.equal(logs.at(-1)?.level, 'ok');
});
