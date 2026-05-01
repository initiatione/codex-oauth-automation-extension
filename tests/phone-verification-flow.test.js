const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/phone-verification-flow.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundPhoneVerification;`)(globalScope);

function buildHeroSmsPricesPayload({ country = '52', service = 'dr', cost = 0.08, count = 25370, physicalCount = 14528 } = {}) {
  return JSON.stringify({
    [country]: {
      [service]: {
        cost,
        count,
        physicalCount,
      },
    },
  });
}

function buildHeroSmsStatusV2Payload({ smsCode = '', smsText = '', callCode = '' } = {}) {
  return JSON.stringify({
    verificationType: 2,
    sms: {
      dateTime: '2026-02-18T16:11:33+00:00',
      code: smsCode,
      text: smsText,
    },
    call: {
      code: callCode,
    },
  });
}

test('phone verification helper requests HeroSMS numbers with fixed OpenAI and Thailand parameters', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      return {
        ok: true,
        text: async () => 'ACCESS_NUMBER:123456:66959916439',
      };
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.deepStrictEqual(activation, {
    activationId: '123456',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 0,
    maxUses: 3,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[0].searchParams.get('service'), 'dr');
  assert.equal(requests[0].searchParams.get('country'), '52');
  assert.equal(requests[0].searchParams.get('api_key'), 'demo-key');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[1].searchParams.get('fixedPrice'), 'true');
  assert.equal(requests[1].searchParams.get('service'), 'dr');
  assert.equal(requests[1].searchParams.get('country'), '52');
  assert.equal(requests[1].searchParams.get('api_key'), 'demo-key');
});

test('phone verification helper retries HeroSMS getPrices until it receives a usable lowest price', async () => {
  const requests = [];
  let getPricesAttempt = 0;
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        getPricesAttempt += 1;
        return getPricesAttempt < 3
          ? {
            ok: true,
            text: async () => JSON.stringify({ unavailable: true }),
          }
          : {
            ok: true,
            text: async () => buildHeroSmsPricesPayload({ cost: 0.09 }),
          };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:123456:66959916439',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.equal(requests.length, 4);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[1].searchParams.get('action'), 'getPrices');
  assert.equal(requests[2].searchParams.get('action'), 'getPrices');
  assert.equal(requests[3].searchParams.get('action'), 'getNumber');
  assert.equal(requests[3].searchParams.get('maxPrice'), '0.09');
  assert.equal(requests[3].searchParams.get('fixedPrice'), 'true');
});

test('phone verification helper falls back to plain getNumber only after HeroSMS getPrices fails three times', async () => {
  const requests = [];
  let getPricesAttempt = 0;
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        getPricesAttempt += 1;
        return {
          ok: true,
          text: async () => JSON.stringify({ unavailable: getPricesAttempt }),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:123456:66959916439',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.equal(requests.length, 4);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[1].searchParams.get('action'), 'getPrices');
  assert.equal(requests[2].searchParams.get('action'), 'getPrices');
  assert.equal(requests[2].searchParams.get('service'), 'dr');
  assert.equal(requests[2].searchParams.get('country'), '52');
  assert.equal(requests[2].searchParams.get('api_key'), 'demo-key');
  assert.equal(requests[3].searchParams.get('action'), 'getNumber');
  assert.equal(requests[3].searchParams.get('maxPrice'), null);
  assert.equal(requests[3].searchParams.get('fixedPrice'), null);
});

test('phone verification helper retries with HeroSMS getNumberV2 when getNumber reports NO_NUMBERS', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country: '16' }),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      if (action === 'getNumberV2') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            activationId: '654321',
            phoneNumber: '447911123456',
          }),
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key', heroSmsCountryId: 16 }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 16,
  });

  assert.deepStrictEqual(activation, {
    activationId: '654321',
    phoneNumber: '447911123456',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 16,
    successfulUses: 0,
    maxUses: 3,
    statusAction: 'getStatusV2',
  });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[0].searchParams.get('country'), '16');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('country'), '16');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[1].searchParams.get('fixedPrice'), 'true');
  assert.equal(requests[2].searchParams.get('action'), 'getNumberV2');
  assert.equal(requests[2].searchParams.get('country'), '16');
  assert.equal(requests[2].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[2].searchParams.get('fixedPrice'), 'true');
});

test('phone verification helper applies ordered fallback countries when primary country has no numbers', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const country = parsedUrl.searchParams.get('country');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            [country]: {
              dr: {
                cost: 0.08,
                count: 100,
              },
            },
          }),
        };
      }

      if (action === 'getNumber' || action === 'getNumberV2') {
        if (country === '52') {
          return { ok: true, text: async () => 'NO_NUMBERS' };
        }
        if (country === '16' && action === 'getNumber') {
          return { ok: true, text: async () => 'ACCESS_NUMBER:861234:447955001122' };
        }
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key', heroSmsCountryId: 52 }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [{ id: 16, label: 'United Kingdom' }],
  });

  assert.equal(activation.countryId, 16);
  assert.equal(activation.phoneNumber, '447955001122');
  const actionTrace = requests.map((requestUrl) => `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('country')}`);
  assert.deepStrictEqual(actionTrace, [
    'getPrices:52',
    'getNumber:52',
    'getNumberV2:52',
    'getPrices:16',
    'getNumber:16',
  ]);
});

test('phone verification helper honors price-priority acquisition mode across selected countries', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const country = parsedUrl.searchParams.get('country');

      if (action === 'getPrices') {
        const cost = country === '52' ? 0.08 : 0.05;
        return {
          ok: true,
          text: async () => JSON.stringify({
            [country]: {
              dr: {
                cost,
                count: 100,
              },
            },
          }),
        };
      }

      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${country}001:44795500${country}`,
        };
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key', heroSmsCountryId: 52 }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [{ id: 16, label: 'United Kingdom' }],
    heroSmsAcquirePriority: 'price',
  });

  assert.equal(activation.countryId, 16);
  const actionTrace = requests.map((requestUrl) => `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('country')}`);
  assert.deepStrictEqual(actionTrace, [
    'getPrices:52',
    'getPrices:16',
    'getNumber:16',
  ]);
});

test('phone verification helper retries acquisition rounds when at least one country reports transient NO_NUMBERS', async () => {
  const requests = [];
  const logs = [];
  const sleeps = [];
  let thailandGetNumberCalls = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const country = parsedUrl.searchParams.get('country');

      if (action === 'getPrices') {
        if (country === '52') {
          return {
            ok: true,
            text: async () => buildHeroSmsPricesPayload({ country: '52', cost: 0.05, count: 20 }),
          };
        }
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country, cost: 0.3, count: 20 }),
        };
      }

      if (action === 'getNumber' || action === 'getNumberV2') {
        if (country === '52') {
          if (action === 'getNumber') {
            thailandGetNumberCalls += 1;
            if (thailandGetNumberCalls >= 2) {
              return {
                ok: true,
                text: async () => 'ACCESS_NUMBER:991122:66951112233',
              };
            }
          }
          return { ok: true, text: async () => 'NO_NUMBERS: Numbers Not Found. Try Later' };
        }
        return { ok: true, text: async () => 'NO_NUMBERS: Numbers Not Found. Try Later' };
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async (ms) => {
      sleeps.push(ms);
    },
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    heroSmsApiKey: 'demo-key',
    heroSmsMaxPrice: '0.06',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [
      { id: 6, label: 'Canada' },
      { id: 5, label: 'Japan' },
    ],
    // Simulate stale state value; helper should still perform at least 2 rounds.
    heroSmsActivationRetryRounds: 1,
  });

  assert.equal(activation.countryId, 52);
  assert.equal(activation.phoneNumber, '66951112233');
  assert.equal(sleeps.length, 1);
  assert.equal(sleeps[0], 2000);
  assert.equal(
    logs.filter((entry) => String(entry.message || '').includes('HeroSMS acquiring phone number')).length >= 2,
    true
  );
  assert.equal(
    logs.some((entry) => String(entry.message || '').includes('HeroSMS has no available numbers (round 1/2); retrying')),
    true
  );
});

test('phone verification helper uses HeroSMS getStatusV2 after acquiring a number via getNumberV2', async () => {
  const requests = [];
  const stateUpdates = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 16,
    heroSmsCountryLabel: 'United Kingdom',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  let statusPollCount = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country: '16' }),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      if (action === 'getNumberV2') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            activationId: '654321',
            phoneNumber: '447911123456',
          }),
        };
      }
      if (action === 'getStatusV2') {
        statusPollCount += 1;
        return {
          ok: true,
          text: async () => (
            statusPollCount === 1
              ? buildHeroSmsStatusV2Payload()
              : buildHeroSmsStatusV2Payload({ smsCode: '112233', smsText: 'Your code is 112233' })
          ),
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      stateUpdates.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(Array.isArray(stateUpdates[0]?.heroSmsLastPriceTiers), true);
  assert.equal(stateUpdates[0]?.heroSmsLastPriceCountryId, 16);
  assert.equal(stateUpdates[0]?.heroSmsLastPriceCountryLabel, 'United Kingdom');
  const v2CodeReceivedAt = stateUpdates
    .find((updates) => updates.currentPhoneActivation?.phoneCodeReceived)
    ?.currentPhoneActivation.phoneCodeReceivedAt;
  assert.equal(Number.isFinite(v2CodeReceivedAt), true);
  assert.deepStrictEqual(stateUpdates.slice(1), [
    {
      currentPhoneActivation: {
        activationId: '654321',
        phoneNumber: '447911123456',
        provider: 'hero-sms',
        serviceCode: 'dr',
        countryId: 16,
        successfulUses: 0,
        maxUses: 3,
        statusAction: 'getStatusV2',
      },
      currentPhoneVerificationCode: '',
    },
    {
      currentPhoneVerificationCode: '112233',
    },
    {
      currentPhoneActivation: {
        activationId: '654321',
        phoneNumber: '447911123456',
        provider: 'hero-sms',
        serviceCode: 'dr',
        countryId: 16,
        successfulUses: 0,
        maxUses: 3,
        statusAction: 'getStatusV2',
        phoneCodeReceived: true,
        phoneCodeReceivedAt: v2CodeReceivedAt,
      },
    },
    {
      reusablePhoneActivation: {
        activationId: '654321',
        phoneNumber: '447911123456',
        provider: 'hero-sms',
        serviceCode: 'dr',
        countryId: 16,
        successfulUses: 1,
        maxUses: 3,
        statusAction: 'getStatusV2',
      },
    },
    {
      currentPhoneActivation: null,
      currentPhoneVerificationCode: '',
    },
  ]);
  const actions = requests.map((url) => url.searchParams.get('action'));
  assert.deepStrictEqual(actions, [
    'getPrices',
    'getNumber',
    'getNumberV2',
    'getStatusV2',
    'getStatusV2',
    'setStatus',
  ]);
});

test('phone verification helper refreshes maxPrice when HeroSMS returns WRONG_MAX_PRICE', async () => {
  const requests = [];
  let getNumberAttempt = 0;
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        getNumberAttempt += 1;
        return getNumberAttempt === 1
          ? {
            ok: false,
            text: async () => 'WRONG_MAX_PRICE:0.09',
          }
          : {
            ok: true,
            text: async () => 'ACCESS_NUMBER:123456:66959916439',
          };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.deepStrictEqual(activation, {
    activationId: '123456',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 0,
    maxUses: 3,
  });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[2].searchParams.get('action'), 'getNumber');
  assert.equal(requests[2].searchParams.get('maxPrice'), '0.09');
  assert.equal(requests[2].searchParams.get('fixedPrice'), 'true');
});

test('phone verification helper climbs price tiers when NO_NUMBERS is returned at lower prices', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const maxPrice = parsedUrl.searchParams.get('maxPrice');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            52: {
              dr: {
                starter: { cost: 0.08, count: 100 },
                premium: { cost: 0.12, count: 100 },
              },
            },
          }),
        };
      }
      if (action === 'getNumber' && maxPrice === '0.08') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      if (action === 'getNumberV2' && maxPrice === '0.08') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      if (action === 'getNumber' && maxPrice === '0.12') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:989898:66951112222',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action} @ ${maxPrice || 'no-price'}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });
  assert.equal(activation.activationId, '989898');
  const actions = requests.map((requestUrl) => `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('maxPrice') || ''}`);
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:0.08',
    'getNumberV2:0.08',
    'getNumber:0.12',
  ]);
});

test('phone verification helper stops when WRONG_MAX_PRICE exceeds configured max price limit', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ cost: 0.08 }),
        };
      }
      if (action === 'getNumber' || action === 'getNumberV2') {
        return {
          ok: false,
          text: async () => 'WRONG_MAX_PRICE:0.08',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key', heroSmsMaxPrice: '0.05' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key', heroSmsMaxPrice: '0.05' }),
    /exceeds configured maxPrice=0\.05/i
  );

  const actions = requests.map((requestUrl) => `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('maxPrice') || ''}`);
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:0.05',
    'getNumberV2:0.05',
  ]);
});

test('phone verification helper falls back to plain getNumber when priced request fails to fetch', async () => {
  const requests = [];
  let getNumberAttempt = 0;
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        getNumberAttempt += 1;
        if (getNumberAttempt === 1) {
          throw new TypeError('Failed to fetch');
        }
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:123456:66959916439',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.deepStrictEqual(activation, {
    activationId: '123456',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 0,
    maxUses: 3,
  });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[1].searchParams.get('fixedPrice'), 'true');
  assert.equal(requests[2].searchParams.get('action'), 'getNumber');
  assert.equal(requests[2].searchParams.get('maxPrice'), null);
  assert.equal(requests[2].searchParams.get('fixedPrice'), null);
});

test('phone verification helper completes add-phone flow, clears current activation, and stores reusable number state', async () => {
  const requests = [];
  const stateUpdates = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:123456:66959916439',
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      stateUpdates.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(Array.isArray(stateUpdates[0]?.heroSmsLastPriceTiers), true);
  assert.equal(stateUpdates[0]?.heroSmsLastPriceCountryId, 52);
  assert.equal(stateUpdates[0]?.heroSmsLastPriceCountryLabel, 'Thailand');
  const codeReceivedAt = stateUpdates
    .find((updates) => updates.currentPhoneActivation?.phoneCodeReceived)
    ?.currentPhoneActivation.phoneCodeReceivedAt;
  assert.equal(Number.isFinite(codeReceivedAt), true);
  assert.deepStrictEqual(stateUpdates.slice(1), [
    {
      currentPhoneActivation: {
        activationId: '123456',
        phoneNumber: '66959916439',
        provider: 'hero-sms',
        serviceCode: 'dr',
        countryId: 52,
        successfulUses: 0,
        maxUses: 3,
      },
      currentPhoneVerificationCode: '',
    },
    {
      currentPhoneVerificationCode: '654321',
    },
    {
      currentPhoneActivation: {
        activationId: '123456',
        phoneNumber: '66959916439',
        provider: 'hero-sms',
        serviceCode: 'dr',
        countryId: 52,
        successfulUses: 0,
        maxUses: 3,
        phoneCodeReceived: true,
        phoneCodeReceivedAt: codeReceivedAt,
      },
    },
    {
      reusablePhoneActivation: {
        activationId: '123456',
        phoneNumber: '66959916439',
        provider: 'hero-sms',
        serviceCode: 'dr',
        countryId: 52,
        successfulUses: 1,
        maxUses: 3,
      },
    },
    {
      currentPhoneActivation: null,
      currentPhoneVerificationCode: '',
    },
  ]);

  const actions = requests.map((url) => url.searchParams.get('action'));
  assert.deepStrictEqual(actions, ['getPrices', 'getNumber', 'getStatus', 'setStatus']);
});

test('phone verification helper keeps polling when HeroSMS waiting status has suffix', async () => {
  const requests = [];
  let statusPollCount = 0;
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getStatus') {
        statusPollCount += 1;
        return {
          ok: true,
          text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_CODE:123456' : 'STATUS_OK:654321'),
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const code = await helpers.pollPhoneActivationCode(
    { heroSmsApiKey: 'demo-key' },
    {
      activationId: '123456',
      phoneNumber: '66959916439',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
    },
    {
      timeoutMs: 5000,
      intervalMs: 1,
      maxRounds: 3,
    }
  );

  assert.equal(code, '654321');
  assert.equal(requests.length, 2);
});

test('phone verification helper uses the configured HeroSMS country for both number acquisition and add-phone submission', async () => {
  const requests = [];
  const submittedPayloads = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 16,
    heroSmsCountryLabel: 'United Kingdom',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country: '16' }),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:654321:447911123456',
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:112233',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        submittedPayloads.push(message.payload);
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[0].searchParams.get('country'), '16');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('country'), '16');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[1].searchParams.get('fixedPrice'), 'true');
  assert.deepStrictEqual(submittedPayloads, [{
    phoneNumber: '447911123456',
    countryId: 16,
    countryLabel: 'United Kingdom',
  }]);
});

test('phone verification helper skips reusable activation when reuse toggle is disabled', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: false,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: 'reuse-001',
      phoneNumber: '66950012345',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'reactivate') {
        throw new Error('reactivate should not be called when reuse is disabled');
      }
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:900001:66958887777' };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_OK:777111' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(result.success, true);
  assert.equal(requests.some((requestUrl) => requestUrl.searchParams.get('action') === 'reactivate'), false);
  assert.equal(currentState.reusablePhoneActivation, null);
});

test('phone verification helper records free reusable phone only after a new activation receives a valid code', async () => {
  const requests = [];
  const logs = [];
  const stateUpdates = [];
  const dataUpdates = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
    freeReusablePhoneActivation: null,
  };
  const realDateNow = Date.now;
  Date.now = () => 1777777777000;

  try {
    const helpers = api.createPhoneVerificationHelpers({
      addLog: async (message, level) => {
        logs.push({ message, level });
      },
      ensureStep8SignupPageReady: async () => {},
      fetchImpl: async (url) => {
        const parsedUrl = new URL(url);
        requests.push(parsedUrl);
        const action = parsedUrl.searchParams.get('action');
        if (action === 'getPrices') {
          return { ok: true, text: async () => buildHeroSmsPricesPayload() };
        }
        if (action === 'getNumber') {
          return { ok: true, text: async () => 'ACCESS_NUMBER:free001:66950001111' };
        }
        if (action === 'getStatus') {
          return { ok: true, text: async () => 'STATUS_OK:123123' };
        }
        if (action === 'setStatus') {
          return { ok: true, text: async () => 'ACCESS_ACTIVATION' };
        }
        throw new Error(`Unexpected HeroSMS action: ${action}`);
      },
      getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
      getState: async () => ({ ...currentState }),
      sendToContentScriptResilient: async (_source, message) => {
        if (message.type === 'SUBMIT_PHONE_NUMBER') {
          return {
            phoneVerificationPage: true,
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
          return {
            success: true,
            consentReady: true,
            url: 'https://auth.openai.com/authorize',
          };
        }
        throw new Error(`Unexpected content-script message: ${message.type}`);
      },
      setState: async (updates) => {
        stateUpdates.push(updates);
        currentState = { ...currentState, ...updates };
      },
      broadcastDataUpdate: (updates) => {
        dataUpdates.push(updates);
      },
      sleepWithStop: async () => {},
      throwIfStopped: () => {},
    });

    await helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    });

    const codeUpdateIndex = stateUpdates.findIndex((updates) => updates.currentPhoneVerificationCode === '123123');
    const freeUpdateIndex = stateUpdates.findIndex((updates) => updates.freeReusablePhoneActivation);
    assert.notEqual(codeUpdateIndex, -1);
    assert.notEqual(freeUpdateIndex, -1);
    assert.equal(freeUpdateIndex > codeUpdateIndex, true);
    assert.equal(
      freeUpdateIndex < stateUpdates.findIndex((updates) => updates.currentPhoneActivation === null),
      true
    );
    assert.deepStrictEqual(currentState.freeReusablePhoneActivation, {
      activationId: 'free001',
      phoneNumber: '66950001111',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
      recordedAt: 1777777777000,
    });
    assert.deepStrictEqual(dataUpdates, [
      {
        freeReusablePhoneActivation: {
          activationId: 'free001',
          phoneNumber: '66950001111',
          provider: 'hero-sms',
          serviceCode: 'dr',
          countryId: 52,
          countryLabel: 'Thailand',
          successfulUses: 0,
          maxUses: 3,
          source: 'free-manual-reuse',
          recordedAt: 1777777777000,
        },
      },
    ]);
    const setStatusRequests = requests.filter((requestUrl) => requestUrl.searchParams.get('action') === 'setStatus');
    assert.deepStrictEqual(setStatusRequests, []);
    assert.ok(
      logs.some(({ message }) => /skipped HeroSMS completion setStatus\(6\).*manual free reuse/i.test(message)),
      'expected a log explaining why HeroSMS completion was skipped'
    );
  } finally {
    Date.now = realDateNow;
  }
});

test('phone verification helper keeps current Step 9 token flow on valid SMS and consent recovery', async () => {
  const requests = [];
  const guardCalls = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
    freeReusablePhoneActivation: null,
  };
  const phoneFlowToken = { id: 'current-success-token' };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    assertStep9PhoneFlowCurrent: async (options = {}) => {
      assert.equal(options.phoneFlowToken?.id, phoneFlowToken.id);
      guardCalls.push(options.actionLabel || options.heroSmsAction || '');
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:current001:66950007777' };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_OK:456456' };
      }
      if (action === 'setStatus') {
        throw new Error('setStatus should be skipped for preserved free reusable phone');
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  }, {
    phoneFlowToken,
  });

  assert.equal(result.consentReady, true);
  assert.equal(currentState.currentPhoneVerificationCode, '');
  assert.equal(currentState.currentPhoneActivation, null);
  assert.equal(currentState.freeReusablePhoneActivation.phoneNumber, '66950007777');
  assert.deepStrictEqual(
    requests.map((requestUrl) => requestUrl.searchParams.get('action')),
    ['getPrices', 'getNumber', 'getStatus']
  );
  assert.ok(guardCalls.includes('submit phone verification code'));
  assert.ok(guardCalls.includes('record free reusable phone after code'));
});

test('phone verification helper records free reusable phone when paid reuse is disabled', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: false,
    freePhoneReuseEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: 'paid-existing',
      phoneNumber: '66950006666',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
    freeReusablePhoneActivation: null,
  };
  const realDateNow = Date.now;
  Date.now = () => 1777777777000;

  try {
    const helpers = api.createPhoneVerificationHelpers({
      addLog: async () => {},
      ensureStep8SignupPageReady: async () => {},
      fetchImpl: async (url) => {
        const parsedUrl = new URL(url);
        requests.push(parsedUrl);
        const action = parsedUrl.searchParams.get('action');
        if (action === 'getPrices') {
          return { ok: true, text: async () => buildHeroSmsPricesPayload() };
        }
        if (action === 'getNumber') {
          return { ok: true, text: async () => 'ACCESS_NUMBER:free-only:66950007777' };
        }
        if (action === 'getStatus') {
          return { ok: true, text: async () => 'STATUS_OK:777888' };
        }
        if (action === 'setStatus') {
          return { ok: true, text: async () => 'ACCESS_ACTIVATION' };
        }
        throw new Error(`Unexpected HeroSMS action: ${action}`);
      },
      getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
      getState: async () => ({ ...currentState }),
      sendToContentScriptResilient: async (_source, message) => {
        if (message.type === 'SUBMIT_PHONE_NUMBER') {
          return {
            phoneVerificationPage: true,
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
          return {
            success: true,
            consentReady: true,
            url: 'https://auth.openai.com/authorize',
          };
        }
        throw new Error(`Unexpected content-script message: ${message.type}`);
      },
      setState: async (updates) => {
        currentState = { ...currentState, ...updates };
      },
      sleepWithStop: async () => {},
      throwIfStopped: () => {},
    });

    await helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    });

    const actions = requests.map((requestUrl) => requestUrl.searchParams.get('action'));
    assert.equal(actions.includes('reactivate'), false);
    assert.deepStrictEqual(currentState.reusablePhoneActivation, null);
    assert.deepStrictEqual(currentState.freeReusablePhoneActivation, {
      activationId: 'free-only',
      phoneNumber: '66950007777',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
      recordedAt: 1777777777000,
    });
    const setStatusRequests = requests.filter((requestUrl) => requestUrl.searchParams.get('action') === 'setStatus');
    assert.deepStrictEqual(setStatusRequests, []);
  } finally {
    Date.now = realDateNow;
  }
});

test('phone verification helper preserves free reusable phone even when paid reuse is enabled', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
    freeReusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:free-paid-on:66950008888' };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_OK:888999' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'ACCESS_ACTIVATION' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  const actions = requests.map((requestUrl) => requestUrl.searchParams.get('action'));
  assert.equal(actions.includes('reactivate'), false);
  assert.equal(actions.includes('setStatus'), false);
  assert.equal(currentState.freeReusablePhoneActivation?.activationId, 'free-paid-on');
  assert.equal(currentState.reusablePhoneActivation?.activationId, 'free-paid-on');
});

test('phone verification helper does not overwrite free reusable phone from paid reactivate activation', async () => {
  const stateUpdates = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: 'paid-old',
      phoneNumber: '66950002222',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
    freeReusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'reactivate') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            activationId: 'paid-new',
            phoneNumber: '66950002222',
          }),
        };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_OK:456456' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'ACCESS_ACTIVATION' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      stateUpdates.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(currentState.freeReusablePhoneActivation, null);
  assert.equal(stateUpdates.some((updates) => updates.freeReusablePhoneActivation), false);
});

test('phone verification helper keeps existing free reusable phone until manual clear', async () => {
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: {
      activationId: 'new-free',
      phoneNumber: '66950004444',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
      source: 'hero-sms-new',
    },
    reusablePhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'free-kept',
      phoneNumber: '66950009999',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
      recordedAt: 1666666666000,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_OK:789789' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'ACCESS_ACTIVATION' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const preservedFreePhone = currentState.freeReusablePhoneActivation;
  await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: false,
    phoneVerificationPage: true,
    url: 'https://auth.openai.com/phone-verification',
  });

  assert.deepStrictEqual(currentState.freeReusablePhoneActivation, preservedFreePhone);
});

test('phone verification helper fills saved free phone and stops before paid HeroSMS APIs', async () => {
  const requests = [];
  const messages = [];
  const stops = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: 'paid-reuse',
      phoneNumber: '66950003333',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
    freeReusablePhoneActivation: {
      activationId: 'free001',
      phoneNumber: '66950001111',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
      recordedAt: 1777777777000,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      throw new Error('HeroSMS paid acquisition APIs should not be called during free handoff');
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    requestStop: async (payload) => {
      stops.push(payload);
    },
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'FILL_PHONE_NUMBER_ONLY') {
        return {
          filled: true,
          submitted: false,
          phoneNumber: message.payload.phoneNumber,
          nationalPhoneNumber: '950001111',
          countryLabel: message.payload.countryLabel,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    () => helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /PHONE_MANUAL_FREE_REUSE::开始手动复用手机 66950001111/
  );

  assert.deepStrictEqual(requests, []);
  assert.deepStrictEqual(messages.map((message) => message.type), ['FILL_PHONE_NUMBER_ONLY']);
  assert.deepStrictEqual(messages[0].payload, {
    phoneNumber: '66950001111',
    countryId: 52,
    countryLabel: 'Thailand',
  });
  assert.equal(stops.length, 1);
  assert.match(stops[0].logMessage, /请到 SMS 上刷新/);
  assert.equal(currentState.currentPhoneActivation, null);
});

test('phone verification helper manually reuses saved free phone without activation id', async () => {
  const messages = [];
  const stops = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: false,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      phoneNumber: '6281534591237',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 6,
      countryLabel: 'Indonesia',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
      manualOnly: true,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async () => {
      throw new Error('HeroSMS APIs should not be called for manual phone-only free reuse');
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    requestStop: async (payload) => {
      stops.push(payload);
    },
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'FILL_PHONE_NUMBER_ONLY') {
        return { addPhonePage: true };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(
      1,
      {
        addPhonePage: true,
        phoneVerificationPage: false,
        url: 'https://auth.openai.com/add-phone',
      },
      { phoneFlowToken: { id: 'stale-test-token' } }
    ),
    /PHONE_MANUAL_FREE_REUSE::/
  );

  assert.equal(messages[0].payload.phoneNumber, '6281534591237');
  assert.equal(messages[0].payload.countryLabel, 'Indonesia');
  assert.equal(stops.length, 1);
});

test('phone verification helper stops automatic phone-only free reuse without paid fallback', async () => {
  const requests = [];
  const stops = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      phoneNumber: '6281534591237',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 6,
      countryLabel: 'Indonesia',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
      manualOnly: true,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      throw new Error(`HeroSMS API should not be called for phone-only automatic preparation: ${parsedUrl.searchParams.get('action')}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    requestStop: async (payload) => {
      stops.push(payload);
    },
    sendToContentScriptResilient: async () => {
      throw new Error('Content script should not receive a submit/fill command before automatic phone-only preparation fails');
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(
      1,
      {
        addPhonePage: true,
        phoneVerificationPage: false,
        url: 'https://auth.openai.com/add-phone',
      },
      { phoneFlowToken: { id: 'stale-free-token' } }
    ),
    /PHONE_AUTO_FREE_REUSE_PREPARE::/
  );

  assert.deepStrictEqual(requests, []);
  assert.equal(stops.length, 1);
  assert.match(stops[0].logMessage, /未确认进入等待短信状态/);
});

test('phone verification helper automatically reuses saved free phone when enabled', async () => {
  const requests = [];
  const messages = [];
  const stops = [];
  let statusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: 'paid-reuse',
      phoneNumber: '66950003333',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
    freeReusablePhoneActivation: {
      activationId: 'free001',
      phoneNumber: '66950001111',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
      recordedAt: 1777777777000,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      const status = parsedUrl.searchParams.get('status');
      if (action === 'setStatus' && id === 'free001' && status === '3') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'free001') {
        statusPollCount += 1;
        return {
          ok: true,
          text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_CODE' : 'STATUS_OK:456789'),
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    requestStop: async (payload) => {
      stops.push(payload);
    },
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(stops, []);
  assert.deepStrictEqual(messages.map((message) => message.type), [
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
  ]);
  assert.deepStrictEqual(messages[0].payload, {
    phoneNumber: '66950001111',
    countryId: 52,
    countryLabel: 'Thailand',
  });
  const actions = requests.map((requestUrl) => {
    const action = requestUrl.searchParams.get('action');
    const id = requestUrl.searchParams.get('id') || '';
    const status = requestUrl.searchParams.get('status') || '';
    return status ? `${action}:${id}:${status}` : `${action}:${id}`;
  });
  assert.deepStrictEqual(actions, [
    'setStatus:free001:3',
    'getStatus:free001',
    'getStatus:free001',
  ]);
  assert.equal(currentState.freeReusablePhoneActivation.successfulUses, 1);
  assert.equal(currentState.freeReusablePhoneActivation.activationId, 'free001');
  assert.equal(currentState.reusablePhoneActivation.activationId, 'paid-reuse');
  assert.equal(currentState.currentPhoneActivation, null);
});

test('phone verification helper accepts suffixed waiting status for automatic free reuse', async () => {
  const requests = [];
  const messages = [];
  let statusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'free-suffix',
      phoneNumber: '66950002222',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'reactivate' || action === 'getPrices' || action === 'getNumber' || action === 'getNumberV2') {
        throw new Error(`${action} should not be called during automatic free reuse preparation`);
      }
      if (action === 'setStatus' && id === 'free-suffix') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'free-suffix') {
        statusPollCount += 1;
        return {
          ok: true,
          text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_RETRY:597243' : 'STATUS_OK:654321'),
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(messages[0].payload.phoneNumber, '66950002222');
  assert.equal(messages[1].payload.code, '654321');
  assert.deepStrictEqual(
    requests.map((requestUrl) => requestUrl.searchParams.get('action')),
    ['setStatus', 'getStatus', 'getStatus']
  );
});

test('phone verification helper gives automatic free reuse priority over paid same-number reactivation', async () => {
  const requests = [];
  let statusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: 'paid-reuse',
      phoneNumber: '66950003333',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
    freeReusablePhoneActivation: {
      activationId: 'free-priority',
      phoneNumber: '66950004444',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'reactivate' || action === 'getPrices' || action === 'getNumber' || action === 'getNumberV2') {
        throw new Error(`${action} should not be called before automatic free reuse`);
      }
      if (action === 'setStatus' && id === 'free-priority') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'free-priority') {
        statusPollCount += 1;
        return { ok: true, text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_CODE' : 'STATUS_OK:112233') };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  const actions = requests.map((requestUrl) => requestUrl.searchParams.get('action'));
  assert.deepStrictEqual(actions, ['setStatus', 'getStatus', 'getStatus']);
});

test('phone verification helper retries stale free reuse code before submitting saved phone', async () => {
  const requests = [];
  const messages = [];
  let freeStatusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'stale-free',
      phoneNumber: '66950005555',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'setStatus' && id === 'stale-free') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'stale-free') {
        freeStatusPollCount += 1;
        return {
          ok: true,
          text: async () => {
            if (freeStatusPollCount === 1) {
              return 'STATUS_OK:999999';
            }
            if (freeStatusPollCount === 2) {
              return 'STATUS_WAIT_CODE';
            }
            return 'STATUS_OK:123456';
          },
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(messages[0].payload.phoneNumber, '66950005555');
  assert.equal(messages[1].payload.code, '123456');
  assert.notEqual(messages[1].payload.code, '999999');
  assert.equal(currentState.freeReusablePhoneActivation.activationId, 'stale-free');
  assert.deepStrictEqual(
    requests.map((requestUrl) => {
      const action = requestUrl.searchParams.get('action');
      const id = requestUrl.searchParams.get('id') || '';
      return `${action}:${id}`;
    }),
    [
      'setStatus:stale-free',
      'getStatus:stale-free',
      'setStatus:stale-free',
      'getStatus:stale-free',
      'getStatus:stale-free',
    ]
  );
});

test('phone verification helper stops failed automatic free reuse without buying new number', async () => {
  const requests = [];
  const messages = [];
  const stops = [];
  const logs = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'cancelled-free',
      phoneNumber: '66950007777',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'setStatus' && id === 'cancelled-free') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'cancelled-free') {
        return { ok: true, text: async () => 'STATUS_CANCEL' };
      }
      if (action === 'reactivate' || action === 'getPrices' || action === 'getNumber' || action === 'getNumberV2') {
        throw new Error(`${action} should not be called after automatic free reuse preparation fails`);
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    requestStop: async (payload) => {
      stops.push(payload);
    },
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /PHONE_AUTO_FREE_REUSE_PREPARE::/
  );

  assert.deepStrictEqual(messages, []);
  assert.equal(stops.length, 1);
  assert.match(stops[0].logMessage, /不购买新 HeroSMS 号码/);
  assert.equal(currentState.freeReusablePhoneActivation, null);
  assert.equal(
    requests.some((requestUrl) => ['reactivate', 'getPrices', 'getNumber', 'getNumberV2'].includes(requestUrl.searchParams.get('action'))),
    false
  );
  assert.ok(logs.some(({ message }) => /no new HeroSMS number will be purchased/i.test(message)));
});

test('phone verification helper retires automatic free reuse record at max uses', async () => {
  const requests = [];
  let statusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'free-max',
      phoneNumber: '66950009999',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 2,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'setStatus' && id === 'free-max') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'free-max') {
        statusPollCount += 1;
        return { ok: true, text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_CODE' : 'STATUS_OK:778899') };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(currentState.freeReusablePhoneActivation, null);
  const actions = requests.map((requestUrl) => {
    const action = requestUrl.searchParams.get('action');
    const id = requestUrl.searchParams.get('id') || '';
    const status = requestUrl.searchParams.get('status') || '';
    return status ? `${action}:${id}:${status}` : `${action}:${id}`;
  });
  assert.deepStrictEqual(actions, [
    'setStatus:free-max:3',
    'getStatus:free-max',
    'getStatus:free-max',
  ]);
});

test('phone verification helper skips HeroSMS cancellation after code-received activation fails', async () => {
  const requests = [];
  const logs = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  let numberIndex = 0;
  const numbers = [
    { activationId: 'code001', phoneNumber: '66950001001' },
    { activationId: 'code002', phoneNumber: '66950001002' },
  ];

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_OK:654321' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          invalidCode: true,
          errorText: 'This phone number is already linked to the maximum number of accounts.',
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /did not succeed after 1 number replacements/i
  );

  const setStatusRequests = requests.filter((requestUrl) => requestUrl.searchParams.get('action') === 'setStatus');
  assert.deepStrictEqual(setStatusRequests, []);
  assert.ok(
    logs.some(({ message }) => /skipped HeroSMS cancellation/i.test(message)),
    'expected a log explaining why cancellation was skipped'
  );
  assert.equal(currentState.currentPhoneActivation, null);
});

test('phone verification helper still cancels activation that never received a code', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const numbers = [
    { activationId: 'timeout001', phoneNumber: '66950002001' },
    { activationId: 'timeout002', phoneNumber: '66950002002' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /did not succeed after 1 number replacements/i
  );

  const canceledIds = requests
    .filter((requestUrl) => requestUrl.searchParams.get('action') === 'setStatus')
    .map((requestUrl) => requestUrl.searchParams.get('id'));
  assert.deepStrictEqual(canceledIds, ['timeout001', 'timeout002']);
});

test('phone verification helper manual free-phone clear only removes local record', async () => {
  const requests = [];
  let currentState = {
    freeReusablePhoneActivation: {
      activationId: 'free-clear',
      phoneNumber: '66950003001',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
      recordedAt: 1777777777000,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      throw new Error('HeroSMS APIs should not be called when clearing local free phone record');
    },
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async () => ({}),
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.clearFreeReusableActivation();

  assert.equal(currentState.freeReusablePhoneActivation, null);
  assert.deepStrictEqual(requests, []);
});

test('phone verification helper stops stale SMS polling before another HeroSMS status call', async () => {
  const requests = [];
  const logs = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 3,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  let guardCurrent = true;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    assertStep9PhoneFlowCurrent: async () => {
      if (!guardCurrent) {
        throw new Error('stale test flow');
      }
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:stale001:66950004001' };
      }
      if (action === 'getStatus') {
        guardCurrent = false;
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }
      throw new Error(`Unexpected HeroSMS action after stale guard: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'CHECK_PHONE_RESEND_ERROR') {
        return {};
      }
      throw new Error(`Unexpected content-script message after stale guard: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }, {
      phoneFlowToken: { id: 'stale-sms-poll-token' },
    }),
    /PHONE_FLOW_STALE::stale test flow/
  );

  const actions = requests.map((requestUrl) => requestUrl.searchParams.get('action'));
  assert.deepStrictEqual(actions, ['getPrices', 'getNumber', 'getStatus']);
  assert.equal(currentState.freeReusablePhoneActivation, undefined);
  assert.ok(
    logs.some(({ message }) => /stale|旧 Step 9|失效/i.test(message)),
    'expected stale flow diagnostic log'
  );
});

test('phone verification helper does not reactivate or clear free reusable phone after stale guard trips', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'free-stale',
      phoneNumber: '66950004002',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
      recordedAt: 1777777777000,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    assertStep9PhoneFlowCurrent: async () => {
      throw new Error('stale free reuse flow');
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      throw new Error('HeroSMS APIs should not be called by stale free reuse flow');
    },
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async () => {
      throw new Error('auth page should not be touched by stale free reuse flow');
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }, {
      phoneFlowToken: { id: 'stale-free-reuse-token' },
    }),
    /PHONE_FLOW_STALE::stale free reuse flow/
  );

  assert.deepStrictEqual(requests, []);
  assert.deepStrictEqual(currentState.freeReusablePhoneActivation, {
    activationId: 'free-stale',
    phoneNumber: '66950004002',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    countryLabel: 'Thailand',
    successfulUses: 0,
    maxUses: 3,
    source: 'free-manual-reuse',
    recordedAt: 1777777777000,
  });
});

test('phone verification helper replaces numbers in step 9 and stops after replacement limit when SMS never arrives', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const statusCallsById = {};
  const realDateNow = Date.now;
  let fakeNow = 0;
  Date.now = () => fakeNow;

  try {
    const helpers = api.createPhoneVerificationHelpers({
      addLog: async () => {},
      ensureStep8SignupPageReady: async () => {},
      fetchImpl: async (url) => {
        const parsedUrl = new URL(url);
        requests.push(parsedUrl);
        const action = parsedUrl.searchParams.get('action');
        const id = parsedUrl.searchParams.get('id');

        if (action === 'getPrices') {
          return {
            ok: true,
            text: async () => buildHeroSmsPricesPayload(),
          };
        }

        if (action === 'getNumber') {
          return {
            ok: true,
            text: async () => 'ACCESS_NUMBER:123456:66959916439',
          };
        }

        if (action === 'getStatus') {
          statusCallsById[id] = (statusCallsById[id] || 0) + 1;
          return {
            ok: true,
            text: async () => 'STATUS_WAIT_CODE',
          };
        }

        if (action === 'setStatus') {
          return {
            ok: true,
            text: async () => 'ACCESS_ACTIVATION',
          };
        }

        throw new Error(`Unexpected HeroSMS action: ${action}`);
      },
      getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
      getState: async () => ({ ...currentState }),
      sendToContentScriptResilient: async (_source, message) => {
        messages.push(message.type);
        if (message.type === 'SUBMIT_PHONE_NUMBER') {
          return {
            phoneVerificationPage: true,
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
          return {
            resent: true,
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        throw new Error(`Unexpected content-script message: ${message.type}`);
      },
      setState: async (updates) => {
        currentState = { ...currentState, ...updates };
      },
      sleepWithStop: async () => {
        fakeNow += 61000;
      },
      throwIfStopped: () => {},
    });

    await assert.rejects(
      helpers.completePhoneVerificationFlow(1, {
        addPhonePage: true,
        phoneVerificationPage: false,
        url: 'https://auth.openai.com/add-phone',
      }),
      /did not succeed after 3 number replacements/i
    );
    assert.ok(statusCallsById['123456'] >= 2, 'first number should be polled twice before being replaced');
    assert.ok(messages.includes('SUBMIT_PHONE_NUMBER'));
    assert.ok(messages.includes('RESEND_PHONE_VERIFICATION_CODE'));
    assert.ok(messages.filter((type) => type === 'SUBMIT_PHONE_NUMBER').length > 1);

    const actions = requests.map((url) => `${url.searchParams.get('action')}:${url.searchParams.get('id') || ''}`);
    assert.ok(actions.filter((action) => action === 'getNumber:').length > 1);
    assert.ok(actions.filter((action) => action === 'getStatus:123456').length >= 2);
    assert.ok(actions.filter((action) => action === 'setStatus:123456').length >= 2);
    assert.equal(currentState.currentPhoneActivation, null);
  } finally {
    Date.now = realDateNow;
  }
});

test('phone verification helper honors timeout-window and poll-round settings before replacing numbers', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:500001:66957776666' };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('resend should not be called when timeout windows is 1');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /did not succeed after 1 number replacements/i
  );

  assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), false);
  assert.ok(
    requests.filter((requestUrl) => requestUrl.searchParams.get('action') === 'getStatus').length >= 2,
    'each replacement attempt should still poll HeroSMS at least once'
  );
});

test('phone verification helper replaces number when banned text appears during first SMS wait', async () => {
  const requests = [];
  const messages = [];
  const logs = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 2,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const numbers = [
    { activationId: 'late001', phoneNumber: '66957770001' },
    { activationId: 'late002', phoneNumber: '66957770002' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        if (id === 'late001') {
          return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
        }
        return { ok: true, text: async () => 'STATUS_OK:333444' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'CHECK_PHONE_RESEND_ERROR') {
        return {
          hasError: true,
          reason: 'resend_phone_banned',
          message: '无法向此电话号码发送短信',
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(result.success, true);
  assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), false);
  assert.equal(messages.filter((type) => type === 'CHECK_PHONE_RESEND_ERROR').length >= 1, true);
  assert.ok(logs.some(({ message }) => /during SMS wait/.test(message)));

  const actions = requests.map((url) => {
    const action = url.searchParams.get('action') || '';
    const id = url.searchParams.get('id') || '';
    const status = url.searchParams.get('status') || '';
    return status ? `${action}:${id}:${status}` : `${action}:${id}`;
  });
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:',
    'getStatus:late001',
    'setStatus:late001:8',
    'getPrices:',
    'getNumber:',
    'getStatus:late002',
    'setStatus:late002:6',
  ]);
});

test('phone verification helper replaces number when Chinese throttled text appears during first SMS wait with risk switch enabled', async () => {
  const requests = [];
  const messages = [];
  const logs = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 2,
    phoneResendThrottledAsBannedEnabled: true,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const numbers = [
    { activationId: 'late051', phoneNumber: '66957770051' },
    { activationId: 'late052', phoneNumber: '66957770052' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        if (id === 'late051') {
          return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
        }
        return { ok: true, text: async () => 'STATUS_OK:555666' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'CHECK_PHONE_RESEND_ERROR') {
        return {
          hasError: true,
          reason: 'resend_throttled',
          message: '尝试重新发送的次数过多。请稍后重试。',
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(result.success, true);
  assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), false);
  assert.ok(logs.some(({ message }) => /high-probability banned/i.test(message)));

  const actions = requests.map((url) => {
    const action = url.searchParams.get('action') || '';
    const id = url.searchParams.get('id') || '';
    const status = url.searchParams.get('status') || '';
    return status ? `${action}:${id}:${status}` : `${action}:${id}`;
  });
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:',
    'getStatus:late051',
    'setStatus:late051:8',
    'getPrices:',
    'getNumber:',
    'getStatus:late052',
    'setStatus:late052:6',
  ]);
});

test('phone verification helper replaces number when throttled text appears after resend during SMS wait with risk switch enabled', async () => {
  const requests = [];
  const messages = [];
  const logs = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    phoneResendThrottledAsBannedEnabled: true,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const numbers = [
    { activationId: 'late101', phoneNumber: '66957770101' },
    { activationId: 'late102', phoneNumber: '66957770102' },
  ];
  let numberIndex = 0;
  let resendClicked = false;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        if (id === 'late101') {
          return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
        }
        return { ok: true, text: async () => 'STATUS_OK:444555' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'CHECK_PHONE_RESEND_ERROR') {
        return resendClicked
          ? {
            hasError: true,
            reason: 'resend_throttled',
            message: 'Tried to resend too many times. Please try again later.',
            url: 'https://auth.openai.com/phone-verification',
          }
          : {
            hasError: false,
            reason: '',
            message: '',
            url: 'https://auth.openai.com/phone-verification',
          };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        resendClicked = true;
        return {
          resent: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(result.success, true);
  assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), true);
  assert.ok(logs.some(({ message }) => /resend is throttled.*during SMS wait/i.test(message)));

  const actions = requests.map((url) => {
    const action = url.searchParams.get('action') || '';
    const id = url.searchParams.get('id') || '';
    const status = url.searchParams.get('status') || '';
    return status ? `${action}:${id}:${status}` : `${action}:${id}`;
  });
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:',
    'getStatus:late101',
    'setStatus:late101:3',
    'getStatus:late101',
    'setStatus:late101:8',
    'getPrices:',
    'getNumber:',
    'getStatus:late102',
    'setStatus:late102:6',
  ]);
});

test('phone verification helper keeps conservative wait when throttled text appears with risk switch disabled', async () => {
  const requests = [];
  const messages = [];
  const logs = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 2,
    phoneResendThrottledAsBannedEnabled: false,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:late201:66957770201' };
      }
      if (action === 'getStatus' && id === 'late201') {
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'CHECK_PHONE_RESEND_ERROR') {
        return {
          hasError: true,
          reason: 'resend_throttled',
          message: '尝试重新发送的次数过多。请稍后重试。',
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /did not succeed after 1 number replacements.*sms_timeout_after_1_windows/i
  );

  assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), false);
  assert.ok(logs.some(({ message }) => /replacement is disabled/i.test(message)));

  const actions = requests.map((url) => {
    const action = url.searchParams.get('action') || '';
    const id = url.searchParams.get('id') || '';
    const status = url.searchParams.get('status') || '';
    return status ? `${action}:${id}:${status}` : `${action}:${id}`;
  });
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:',
    'getStatus:late201',
    'getStatus:late201',
    'setStatus:late201:8',
    'getPrices:',
    'getNumber:',
    'getStatus:late201',
    'getStatus:late201',
    'setStatus:late201:8',
  ]);
});

test('phone verification helper respects configured number replacement limit', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  let submitCodeCount = 0;
  const numbers = [
    { activationId: '411111', phoneNumber: '66950000111' },
    { activationId: '422222', phoneNumber: '66950000222' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submitCodeCount += 1;
        return {
          invalidCode: true,
          errorText: `This phone number is already linked to the maximum number of accounts. (${submitCodeCount})`,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /did not succeed after 1 number replacements/i
  );

  const actions = requests.map((requestUrl) => requestUrl.searchParams.get('action'));
  assert.deepStrictEqual(actions, [
    'getPrices',
    'getNumber',
    'getStatus',
    'getPrices',
    'getNumber',
    'getStatus',
  ]);
});

test('phone verification helper reuses the current number first when code submission returns to add-phone', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '111111', phoneNumber: '66950000001' },
    { activationId: '222222', phoneNumber: '66950000002' },
  ];
  let numberIndex = 0;
  let submitCodeCount = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }

      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submitCodeCount += 1;
        return submitCodeCount === 1
          ? {
            returnedToAddPhone: true,
            url: 'https://auth.openai.com/add-phone',
          }
          : {
            success: true,
            consentReady: true,
            url: 'https://auth.openai.com/authorize',
          };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        return {
          resent: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(messages, [
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
  ]);

  const actions = requests.map((url) => `${url.searchParams.get('action')}:${url.searchParams.get('id') || ''}`);
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:',
    'getStatus:111111',
    'getStatus:111111',
    'setStatus:111111',
  ]);
  assert.deepStrictEqual(currentState.currentPhoneActivation, null);
  assert.deepStrictEqual(currentState.reusablePhoneActivation, {
    activationId: '111111',
    phoneNumber: '66950000001',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 1,
    maxUses: 3,
  });
});

test('phone verification helper immediately replaces number when page says the phone number was already used', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '311111', phoneNumber: '66950000011' },
    { activationId: '322222', phoneNumber: '66950000022' },
  ];
  let numberIndex = 0;
  let submitCodeCount = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submitCodeCount += 1;
        if (submitCodeCount === 1) {
          return {
            invalidCode: true,
            errorText: 'This phone number is already linked to the maximum number of accounts.',
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('should not resend for already-used number');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(messages, [
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
    'RETURN_TO_ADD_PHONE',
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
  ]);
});

test('phone verification helper reuses the same number up to three successful registrations', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 2,
      maxUses: 3,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'reactivate') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            activationId: '222333',
            phoneNumber: '66959916439',
          }),
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(requests[0].searchParams.get('action'), 'reactivate');
  assert.equal(requests[0].searchParams.get('id'), '123456');
  assert.deepStrictEqual(currentState.reusablePhoneActivation, null);
});

test('phone verification helper keeps maxUses behavior for reused V2 activations', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 16,
    heroSmsCountryLabel: 'United Kingdom',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: '123456',
      phoneNumber: '447911123456',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 16,
      successfulUses: 2,
      maxUses: 3,
      statusAction: 'getStatusV2',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'reactivate') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            activationId: '222333',
            phoneNumber: '447911123456',
          }),
        };
      }
      if (action === 'getStatusV2') {
        return {
          ok: true,
          text: async () => buildHeroSmsStatusV2Payload({ smsCode: '654321', smsText: 'Your code is 654321' }),
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  const actions = requests.map((url) => url.searchParams.get('action'));
  assert.deepStrictEqual(actions, ['reactivate', 'getStatusV2', 'setStatus']);
  assert.deepStrictEqual(currentState.reusablePhoneActivation, null);
});

test('phone verification helper replaces number immediately when resend is throttled and does not spam resend clicks', async () => {
  const requests = [];
  const messages = [];
  let resendCalls = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 3,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    phoneResendThrottledAsBannedEnabled: true,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '900001', phoneNumber: '66951110001' },
    { activationId: '900002', phoneNumber: '66951110002' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        if (id === '900001') {
          return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
        }
        return { ok: true, text: async () => 'STATUS_OK:654321' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => `STATUS_UPDATED:${id}` };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        resendCalls += 1;
        throw new Error('PHONE_RESEND_THROTTLED::Tried to resend too many times. Please try again later.');
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(resendCalls, 1, 'resend should be attempted once for the number before replacement');
  assert.equal(messages.filter((type) => type === 'SUBMIT_PHONE_NUMBER').length, 2);
  assert.equal(messages.includes('RETURN_TO_ADD_PHONE'), true);
});

test('phone verification helper replaces number immediately when resend reports phone cannot receive SMS', async () => {
  const requests = [];
  const messages = [];
  const logs = [];
  let resendCalls = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '910001', phoneNumber: '66951110101' },
    { activationId: '910002', phoneNumber: '66951110102' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        if (id === '910001') {
          return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
        }
        return { ok: true, text: async () => 'STATUS_OK:654321' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => `STATUS_UPDATED:${id}` };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        resendCalls += 1;
        throw new Error('PHONE_RESEND_BANNED_NUMBER::无法向此电话号码发送短信');
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(resendCalls, 1);
  assert.equal(messages.filter((type) => type === 'SUBMIT_PHONE_NUMBER').length, 2);
  assert.equal(messages.includes('RETURN_TO_ADD_PHONE'), true);
  assert.ok(logs.some(({ message }) => /OpenAI could not send SMS/.test(message)));

  const actions = requests.map((url) => {
    const action = url.searchParams.get('action') || '';
    const id = url.searchParams.get('id') || '';
    const status = url.searchParams.get('status') || '';
    return status ? `${action}:${id}:${status}` : `${action}:${id}`;
  });
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:',
    'getStatus:910001',
    'setStatus:910001:3',
    'setStatus:910001:8',
    'getPrices:',
    'getNumber:',
    'getStatus:910002',
    'setStatus:910002:6',
  ]);
});

test('phone verification helper replaces number when resend after invalid code reports phone cannot receive SMS', async () => {
  const requests = [];
  const logs = [];
  let submitCodeCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 1,
    phoneVerificationReplacementLimit: 2,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '915001', phoneNumber: '66951110501' },
    { activationId: '915002', phoneNumber: '66951110502' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_OK:654321' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => `STATUS_UPDATED:${id}` };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submitCodeCount += 1;
        if (submitCodeCount === 1) {
          return {
            invalidCode: true,
            errorText: 'The verification code is invalid.',
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('PHONE_RESEND_BANNED_NUMBER::无法向此电话号码发送短信');
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(result.success, true);
  assert.ok(logs.some(({ message }) => /OpenAI could not send SMS/.test(message)));

  const actions = requests.map((url) => {
    const action = url.searchParams.get('action') || '';
    const id = url.searchParams.get('id') || '';
    const status = url.searchParams.get('status') || '';
    return status ? `${action}:${id}:${status}` : `${action}:${id}`;
  });
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:',
    'getStatus:915001',
    'setStatus:915001:3',
    'getPrices:',
    'getNumber:',
    'getStatus:915002',
    'setStatus:915002:6',
  ]);
});

test('phone verification helper reports resend_phone_banned when banned replacement limit is exhausted', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const numbers = [
    { activationId: '920001', phoneNumber: '66951110201' },
    { activationId: '920002', phoneNumber: '66951110202' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('PHONE_RESEND_BANNED_NUMBER::无法向此电话号码发送短信');
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /Last reason: resend_phone_banned/i
  );
});

test('phone verification helper falls back to the next country after repeated sms timeout on the same country', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [{ id: 16, label: 'United Kingdom' }],
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 3,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  let thailandAcquireIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      const country = parsedUrl.searchParams.get('country');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            [country]: {
              dr: {
                cost: country === '52' ? 0.08 : 0.09,
                count: 100,
              },
            },
          }),
        };
      }

      if (action === 'getNumber') {
        if (country === '52') {
          thailandAcquireIndex += 1;
          return {
            ok: true,
            text: async () => `ACCESS_NUMBER:52${thailandAcquireIndex}:66950000${thailandAcquireIndex}`,
          };
        }
        if (country === '16') {
          return {
            ok: true,
            text: async () => 'ACCESS_NUMBER:160001:447955001122',
          };
        }
      }

      if (action === 'getStatus') {
        if (id === '160001') {
          return { ok: true, text: async () => 'STATUS_OK:888999' };
        }
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }

      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country || 'n/a'}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });

  const getNumberCountries = requests
    .filter((requestUrl) => requestUrl.searchParams.get('action') === 'getNumber')
    .map((requestUrl) => requestUrl.searchParams.get('country'));
  assert.deepStrictEqual(getNumberCountries, ['52', '52', '16']);
});
