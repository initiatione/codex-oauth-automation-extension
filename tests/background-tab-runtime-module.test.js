const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports tab runtime module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/tab-runtime\.js/);
});

test('tab runtime module exposes a factory', () => {
  const source = fs.readFileSync('background/tab-runtime.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundTabRuntime;`)(globalScope);

  assert.equal(typeof api?.createTabRuntime, 'function');
});

test('tab runtime caps per-attempt response timeout to the remaining resilient timeout budget', () => {
  const source = fs.readFileSync('background/tab-runtime.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundTabRuntime;`)(globalScope);

  const runtime = api.createTabRuntime({
    LOG_PREFIX: '[test]',
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async () => ({ id: 1, url: 'https://example.com', status: 'complete' }),
        query: async () => [],
      },
    },
    getSourceLabel: (source) => source || 'unknown',
    getState: async () => ({ tabRegistry: {}, sourceLastUrls: {} }),
    matchesSourceUrlFamily: () => false,
    normalizeLocalCpaStep9Mode: () => 'submit',
    parseUrlSafely: () => null,
    registerTab: async () => {},
    setState: async () => {},
    shouldBypassStep9ForLocalCpa: () => false,
    throwIfStopped: () => {},
  });

  assert.equal(
    runtime.resolveResponseTimeoutMs({ type: 'PREPARE_SIGNUP_VERIFICATION' }, undefined, 30000),
    30000
  );
  assert.equal(
    runtime.resolveResponseTimeoutMs({ type: 'PREPARE_SIGNUP_VERIFICATION' }, 12000, 5000),
    5000
  );
});

test('tab runtime waitForTabComplete waits until tab status becomes complete', async () => {
  const source = fs.readFileSync('background/tab-runtime.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundTabRuntime;`)(globalScope);

  let getCalls = 0;
  const runtime = api.createTabRuntime({
    LOG_PREFIX: '[test]',
    addLog: async () => {},
    buildLocalhostCleanupPrefix: () => '',
    chrome: {
      tabs: {
        get: async () => {
          getCalls += 1;
          return {
            id: 9,
            url: 'https://example.com',
            status: getCalls >= 3 ? 'complete' : 'loading',
          };
        },
        query: async () => [],
      },
    },
    getSourceLabel: (source) => source || 'unknown',
    getState: async () => ({ tabRegistry: {}, sourceLastUrls: {} }),
    matchesSourceUrlFamily: () => false,
    normalizeLocalCpaStep9Mode: () => 'submit',
    parseUrlSafely: () => null,
    registerTab: async () => {},
    setState: async () => {},
    shouldBypassStep9ForLocalCpa: () => false,
    throwIfStopped: () => {},
  });

  const result = await runtime.waitForTabComplete(9, {
    timeoutMs: 2000,
    retryDelayMs: 1,
  });

  assert.equal(result?.status, 'complete');
  assert.equal(getCalls, 3);
});

test('tab runtime waitForTabComplete aborts promptly when stop is requested', async () => {
  const source = fs.readFileSync('background/tab-runtime.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundTabRuntime;`)(globalScope);

  let throwCalls = 0;
  const runtime = api.createTabRuntime({
    LOG_PREFIX: '[test]',
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async () => ({
          id: 9,
          url: 'https://example.com',
          status: 'loading',
        }),
        query: async () => [],
      },
    },
    getSourceLabel: (sourceName) => sourceName || 'unknown',
    getState: async () => ({ tabRegistry: {}, sourceLastUrls: {} }),
    matchesSourceUrlFamily: () => false,
    setState: async () => {},
    throwIfStopped: () => {
      throwCalls += 1;
      if (throwCalls >= 2) {
        throw new Error('Flow stopped.');
      }
    },
  });

  await assert.rejects(
    runtime.waitForTabComplete(9, {
      timeoutMs: 2000,
      retryDelayMs: 1,
    }),
    /Flow stopped\./
  );
});

test('tab runtime waitForTabStableComplete waits through a late navigation after an initial complete state', async () => {
  const source = fs.readFileSync('background/tab-runtime.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundTabRuntime;`)(globalScope);

  let getCalls = 0;
  const runtime = api.createTabRuntime({
    LOG_PREFIX: '[test]',
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async () => {
          getCalls += 1;
          if (getCalls === 1) {
            return {
              id: 9,
              url: 'https://auth.openai.com/u/signup/profile',
              status: 'complete',
            };
          }
          if (getCalls === 2) {
            return {
              id: 9,
              url: 'https://chatgpt.com/',
              status: 'loading',
            };
          }
          return {
            id: 9,
            url: 'https://chatgpt.com/',
            status: 'complete',
          };
        },
        query: async () => [],
      },
    },
    getSourceLabel: (sourceName) => sourceName || 'unknown',
    getState: async () => ({ tabRegistry: {}, sourceLastUrls: {} }),
    matchesSourceUrlFamily: () => false,
    setState: async () => {},
    throwIfStopped: () => {},
  });

  const result = await runtime.waitForTabStableComplete(9, {
    timeoutMs: 2000,
    retryDelayMs: 5,
    stableMs: 5,
    initialDelayMs: 1,
  });

  assert.equal(result?.url, 'https://chatgpt.com/');
  assert.equal(result?.status, 'complete');
  assert.ok(getCalls >= 4);
});

test('tab runtime gives recovered iCloud POLL_EMAIL attempts a practical response timeout floor', async () => {
  const source = fs.readFileSync('background/tab-runtime.js', 'utf8');
  const globalScope = {};
  const timeoutCalls = [];
  const fakeSetTimeout = (fn, ms) => {
    timeoutCalls.push(ms);
    if (ms >= 30000) {
      Promise.resolve().then(fn);
    }
    return { ms };
  };
  const fakeClearTimeout = () => {};
  const api = new Function(
    'self',
    'setTimeout',
    'clearTimeout',
    `${source}; return self.MultiPageBackgroundTabRuntime;`
  )(globalScope, fakeSetTimeout, fakeClearTimeout);

  let sendCalls = 0;
  const runtime = api.createTabRuntime({
    LOG_PREFIX: '[test]',
    addLog: async () => {},
    chrome: {
      scripting: {
        executeScript: async () => {},
      },
      tabs: {
        create: async () => ({ id: 2, url: 'https://www.icloud.com/mail/', status: 'complete' }),
        get: async () => ({ id: 1, url: 'https://www.icloud.com/mail/', status: 'complete' }),
        onUpdated: {
          addListener: () => {},
          removeListener: () => {},
        },
        query: async () => [],
        reload: async () => {},
        sendMessage: async () => {
          sendCalls += 1;
          if (sendCalls === 1) {
            throw new Error('Content script on icloud-mail did not respond in 1s. Try refreshing the tab and retry.');
          }
          return { ok: true, code: '654321' };
        },
        update: async () => ({ id: 1, url: 'https://www.icloud.com/mail/', status: 'complete' }),
      },
    },
    getSourceLabel: (sourceName) => sourceName || 'unknown',
    getState: async () => ({
      tabRegistry: { 'icloud-mail': { tabId: 1, ready: true } },
      sourceLastUrls: {},
    }),
    isRetryableContentScriptTransportError: (error) => /did not respond/i.test(String(error?.message || error)),
    matchesSourceUrlFamily: () => false,
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await runtime.sendToMailContentScriptResilient(
    {
      source: 'icloud-mail',
      label: 'iCloud 邮箱',
      url: 'https://www.icloud.com/mail/',
    },
    {
      type: 'POLL_EMAIL',
      step: 8,
      source: 'background',
      payload: { maxAttempts: 1, intervalMs: 3000 },
    },
    {
      timeoutMs: 20000,
      responseTimeoutMs: 1000,
      maxRecoveryAttempts: 1,
    }
  );

  assert.equal(result.code, '654321');
  assert.deepStrictEqual(timeoutCalls.filter((ms) => ms === 1000 || ms === 10000), [1000, 10000]);
});

test('tab runtime recovers a cached iCloud POLL_EMAIL success before warning or reload escalation', async () => {
  const source = fs.readFileSync('background/tab-runtime.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundTabRuntime;`)(globalScope);

  const logs = [];
  let sendCalls = 0;
  let removed = false;
  let createCalls = 0;
  let updateCalls = 0;
  const runtime = api.createTabRuntime({
    LOG_PREFIX: '[test]',
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    chrome: {
      scripting: {
        executeScript: async () => {},
      },
      storage: {
        session: {
          async get(key) {
            return {
              [key]: {
                sessionKey: '8:123456',
                step: 8,
                code: '654321',
                emailTimestamp: 123,
                preview: 'cached preview',
                cachedAt: 999,
              },
            };
          },
          async remove() {
            removed = true;
          },
        },
      },
      tabs: {
        create: async () => {
          createCalls += 1;
          return { id: 2, url: 'https://www.icloud.com/mail/', status: 'complete' };
        },
        get: async () => ({ id: 1, url: 'https://www.icloud.com/mail/', status: 'complete' }),
        onUpdated: {
          addListener: () => {},
          removeListener: () => {},
        },
        query: async () => [],
        reload: async () => {},
        sendMessage: async () => {
          sendCalls += 1;
          throw new Error('Content script on icloud-mail did not respond in 1s. Try refreshing the tab and retry.');
        },
        update: async () => {
          updateCalls += 1;
          return { id: 1, url: 'https://www.icloud.com/mail/', status: 'complete' };
        },
      },
    },
    getSourceLabel: (sourceName) => sourceName || 'unknown',
    getState: async () => ({
      tabRegistry: { 'icloud-mail': { tabId: 1, ready: true } },
      sourceLastUrls: {},
    }),
    isRetryableContentScriptTransportError: (error) => /did not respond/i.test(String(error?.message || error)),
    matchesSourceUrlFamily: () => false,
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await runtime.sendToMailContentScriptResilient(
    {
      source: 'icloud-mail',
      label: 'iCloud 邮箱',
      url: 'https://www.icloud.com/mail/',
    },
    {
      type: 'POLL_EMAIL',
      step: 8,
      source: 'background',
      payload: { sessionKey: '8:123456', maxAttempts: 1, intervalMs: 3000 },
    },
    {
      timeoutMs: 20000,
      responseTimeoutMs: 1000,
      maxRecoveryAttempts: 1,
    }
  );

  assert.deepStrictEqual(result, {
    ok: true,
    code: '654321',
    emailTimestamp: 123,
    preview: 'cached preview',
    sessionKey: '8:123456',
    transportRecovered: true,
  });
  assert.equal(sendCalls, 1);
  assert.equal(removed, true);
  assert.equal(createCalls, 0);
  assert.equal(updateCalls, 0);
  assert.deepStrictEqual(logs, []);
});

test('tab runtime keeps non-iCloud recovered POLL_EMAIL response timeouts unchanged', async () => {
  const source = fs.readFileSync('background/tab-runtime.js', 'utf8');
  const globalScope = {};
  const timeoutCalls = [];
  const fakeSetTimeout = (fn, ms) => {
    timeoutCalls.push(ms);
    if (ms >= 30000) {
      Promise.resolve().then(fn);
    }
    return { ms };
  };
  const fakeClearTimeout = () => {};
  const api = new Function(
    'self',
    'setTimeout',
    'clearTimeout',
    `${source}; return self.MultiPageBackgroundTabRuntime;`
  )(globalScope, fakeSetTimeout, fakeClearTimeout);

  let sendCalls = 0;
  const runtime = api.createTabRuntime({
    LOG_PREFIX: '[test]',
    addLog: async () => {},
    chrome: {
      scripting: {
        executeScript: async () => {},
      },
      tabs: {
        create: async () => ({ id: 2, url: 'https://mail.example.test/', status: 'complete' }),
        get: async () => ({ id: 1, url: 'https://mail.example.test/', status: 'complete' }),
        onUpdated: {
          addListener: () => {},
          removeListener: () => {},
        },
        query: async () => [],
        reload: async () => {},
        sendMessage: async () => {
          sendCalls += 1;
          if (sendCalls === 1) {
            throw new Error('Content script on qq-mail did not respond in 1s. Try refreshing the tab and retry.');
          }
          return { ok: true, code: '654321' };
        },
        update: async () => ({ id: 1, url: 'https://mail.example.test/', status: 'complete' }),
      },
    },
    getSourceLabel: (sourceName) => sourceName || 'unknown',
    getState: async () => ({
      tabRegistry: { 'qq-mail': { tabId: 1, ready: true } },
      sourceLastUrls: {},
    }),
    isRetryableContentScriptTransportError: (error) => /did not respond/i.test(String(error?.message || error)),
    matchesSourceUrlFamily: () => false,
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await runtime.sendToMailContentScriptResilient(
    {
      source: 'qq-mail',
      label: 'QQ 邮箱',
      url: 'https://mail.example.test/',
    },
    {
      type: 'POLL_EMAIL',
      step: 8,
      source: 'background',
      payload: { maxAttempts: 1, intervalMs: 3000 },
    },
    {
      timeoutMs: 20000,
      responseTimeoutMs: 1000,
      maxRecoveryAttempts: 1,
    }
  );

  assert.equal(result.code, '654321');
  assert.deepStrictEqual(timeoutCalls.filter((ms) => ms === 1000 || ms === 10000), [1000, 1000]);
});
