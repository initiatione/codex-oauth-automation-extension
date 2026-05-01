const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

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
