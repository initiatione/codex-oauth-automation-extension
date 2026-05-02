const assert = require('assert');
const fs = require('fs');
const test = require('node:test');

const backgroundSource = fs.readFileSync('background.js', 'utf8');
const step9ModuleSource = fs.readFileSync('background/steps/confirm-oauth.js', 'utf8');

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

function createStep9FailureStopApi(overrides = {}) {
  return new Function('step9ModuleSource', `
const self = {};
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
let capturedPhoneFlowToken = null;
let pendingReject = null;
let beforeNavigateListener = null;
let committedListener = null;
let tabUpdatedListener = null;
let pendingCallbackUrl = '';

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
${extractFunction(backgroundSource, 'throwIfStep8SettledOrStopped')}

const chrome = {
  webNavigation: {
    onBeforeNavigate: {
      addListener(listener) {
        beforeNavigateListener = listener;
      },
      removeListener() {},
    },
    onCommitted: {
      addListener(listener) {
        committedListener = listener;
      },
      removeListener() {},
    },
  },
  tabs: {
    onUpdated: {
      addListener(listener) {
        tabUpdatedListener = listener;
      },
      removeListener() {},
    },
    async update() {},
  },
};

function cleanupStep8NavigationListeners() {
  beforeNavigateListener = null;
  committedListener = null;
  tabUpdatedListener = null;
}

async function clickWithDebugger() {}
async function ensureStep8SignupPageReady() {}
async function getOAuthFlowRemainingMs() { return null; }
async function getOAuthFlowStepTimeoutMs(defaultTimeoutMs) { return defaultTimeoutMs; }
function getStep8CallbackUrlFromNavigation(details, signupTabId) {
  const signupTabMatches = signupTabId == null || Number(details?.tabId) === Number(signupTabId);
  if (signupTabMatches && String(details?.url || '').includes('callback')) {
    return details.url;
  }
  return '';
}
function getStep8CallbackUrlFromTabUpdate(tabId, changeInfo, tab, signupTabId) {
  const url = String(changeInfo?.url || tab?.url || '');
  const signupTabMatches = signupTabId == null || Number(tabId) === Number(signupTabId);
  if (signupTabMatches && url.includes('callback')) {
    return url;
  }
  return '';
}
function getStep8EffectLabel() {
  return '页面仍停留在 OAuth 同意页';
}
async function getTabId() { return 88; }
async function isTabAlive() { return true; }
async function prepareStep8DebuggerClick() { return { rect: { centerX: 10, centerY: 10 } }; }
async function recoverOAuthLocalhostTimeout() { throw new Error('should not recover timeout in this test'); }
async function reloadStep8ConsentPage() {}
async function reuseOrCreateTab() { return 88; }
async function sleepWithStop() {}
function flushPendingCallbackIfPossible() {
  if (pendingCallbackUrl && typeof beforeNavigateListener === 'function') {
    const url = pendingCallbackUrl;
    pendingCallbackUrl = '';
    beforeNavigateListener({ tabId: 88, frameId: 0, url });
  }
}

function setWebNavListener(listener) {
  beforeNavigateListener = listener;
  flushPendingCallbackIfPossible();
}
function setWebNavCommittedListener(listener) { committedListener = listener; }
function setStep8PendingReject(handler) { pendingReject = handler; }
function setStep8TabUpdatedListener(listener) { tabUpdatedListener = listener; }
function getWebNavListener() { return beforeNavigateListener; }
function getWebNavCommittedListener() { return committedListener; }
function getStep8TabUpdatedListener() { return tabUpdatedListener; }

async function completeStepFromBackground(step, payload) {
  if (${JSON.stringify(Boolean(overrides.failCompleteStep))}) {
    throw new Error('step9 completion sync failed');
  }
  return { step, payload };
}

async function triggerStep8ContentStrategy() {
  return { success: true };
}

async function waitForStep8Ready() {
  return {
    consentReady: true,
    url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
  };
}

async function waitForStep8ClickEffect() {
  if (${JSON.stringify(Boolean(overrides.autoTriggerCallbackOnEffect))}) {
    const callbackUrl = 'http://localhost:1455/auth/callback?code=abc&state=xyz';
    if (typeof beforeNavigateListener === 'function') {
      beforeNavigateListener({ tabId: 88, frameId: 0, url: callbackUrl });
    } else {
      pendingCallbackUrl = callbackUrl;
    }
  }
  return ${JSON.stringify(overrides.effectResult || { progressed: false, reason: 'no_effect', url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent' })};
}

const STEP8_CLICK_RETRY_DELAY_MS = 0;
const STEP8_MAX_ROUNDS = 1;
const STEP8_READY_WAIT_TIMEOUT_MS = 1000;
const STEP8_STRATEGIES = [{ mode: 'content', strategy: 'requestSubmit', label: 'form.requestSubmit' }];

${step9ModuleSource}

const originalCreateStep9PhoneFlowToken = createStep9PhoneFlowToken;
async function wrappedCreateStep9PhoneFlowToken(details = {}) {
  const token = await originalCreateStep9PhoneFlowToken(details);
  capturedPhoneFlowToken = token;
  return token;
}

const executor = self.MultiPageBackgroundStep9.createStep9Executor({
  addLog,
  chrome,
  cleanupStep8NavigationListeners,
  clickWithDebugger,
  completeStepFromBackground,
  createStep9PhoneFlowToken: wrappedCreateStep9PhoneFlowToken,
  ensureStep8SignupPageReady,
  getOAuthFlowRemainingMs,
  getOAuthFlowStepTimeoutMs,
  getStep8CallbackUrlFromNavigation,
  getStep8CallbackUrlFromTabUpdate,
  getStep8EffectLabel,
  getTabId,
  getWebNavCommittedListener,
  getWebNavListener,
  getStep8TabUpdatedListener,
  invalidateStep9PhoneFlow,
  isTabAlive,
  prepareStep8DebuggerClick,
  recoverOAuthLocalhostTimeout,
  reloadStep8ConsentPage,
  reuseOrCreateTab,
  setStep8PendingReject,
  setStep8TabUpdatedListener,
  setWebNavCommittedListener,
  setWebNavListener,
  sleepWithStop,
  STEP8_CLICK_RETRY_DELAY_MS,
  STEP8_MAX_ROUNDS,
  STEP8_READY_WAIT_TIMEOUT_MS,
  STEP8_STRATEGIES,
  throwIfStep8SettledOrStopped,
  triggerStep8ContentStrategy,
  waitForStep8ClickEffect,
  waitForStep8Ready,
});

return {
  executeStep9: executor.executeStep9,
  assertStep9PhoneFlowCurrent,
  triggerCallback(url = 'http://localhost:1455/auth/callback?code=abc&state=xyz') {
    if (typeof beforeNavigateListener === 'function') {
      beforeNavigateListener({ tabId: 88, frameId: 0, url });
      return;
    }
    pendingCallbackUrl = url;
  },
  snapshot() {
    return {
      logs: logs.slice(),
      capturedPhoneFlowToken,
    };
  },
};
`)(step9ModuleSource);
}

test('step 9 click-failure rejection invalidates the active phone-flow token', async () => {
  const api = createStep9FailureStopApi({
    effectResult: {
      progressed: false,
      reason: 'no_effect',
      url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
    },
  });

  await assert.rejects(
    api.executeStep9({ oauthUrl: 'https://auth.openai.com/oauth/authorize?old=1', visibleStep: 9 }),
    /连续 1 轮点击“继续”后页面仍无反应/
  );

  const { capturedPhoneFlowToken } = api.snapshot();
  assert.ok(capturedPhoneFlowToken, 'expected step 9 to create a phone-flow token');

  await assert.rejects(
    api.assertStep9PhoneFlowCurrent({
      phoneFlowToken: capturedPhoneFlowToken,
      actionLabel: 'HeroSMS getStatus',
    }),
    /PHONE_FLOW_STALE::Step 9 phone flow is stale before HeroSMS getStatus/
  );
});

test('step 9 completion failure still invalidates the active phone-flow token', async () => {
  const api = createStep9FailureStopApi({
    failCompleteStep: true,
    autoTriggerCallbackOnEffect: true,
    effectResult: {
      progressed: true,
      reason: 'url_changed',
      url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
    },
  });

  const promise = api.executeStep9({
    oauthUrl: 'https://auth.openai.com/oauth/authorize?old=1',
    visibleStep: 9,
  });

  await assert.rejects(
    promise,
    /step9 completion sync failed/
  );

  const { capturedPhoneFlowToken } = api.snapshot();
  assert.ok(capturedPhoneFlowToken, 'expected step 9 to create a phone-flow token');

  await assert.rejects(
    api.assertStep9PhoneFlowCurrent({
      phoneFlowToken: capturedPhoneFlowToken,
      actionLabel: 'HeroSMS setStatus(3)',
    }),
    /PHONE_FLOW_STALE::Step 9 phone flow is stale before HeroSMS setStatus\(3\)/
  );
});
