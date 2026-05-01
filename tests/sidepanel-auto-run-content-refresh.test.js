const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => sidepanelSource.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < sidepanelSource.length; i += 1) {
    const ch = sidepanelSource[i];
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
  for (; end < sidepanelSource.length; end += 1) {
    const ch = sidepanelSource[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return sidepanelSource.slice(start, end);
}

function createApi({
  refreshImpl,
  runCount = 3,
  lockedRunCount = 0,
  plusModeEnabled = false,
  plusRiskEnabled = false,
  plusRiskConfirmed = true,
  plusRiskDismissPrompt = false,
  plusContributionImpl,
} = {}) {
  const bundle = extractFunction('startAutoRunFromCurrentSettings');

  return new Function(`
const events = [];
const latestState = { contributionMode: false };
const currentPlusModeEnabled = ${JSON.stringify(Boolean(plusModeEnabled))};
const inputPlusModeEnabled = { checked: ${JSON.stringify(Boolean(plusModeEnabled))} };
const inputAutoSkipFailures = { checked: false };
const inputContributionNickname = { value: 'tester' };
const inputContributionQq = { value: '123456' };
const inputAutoSkipFailuresThreadIntervalMinutes = { value: '5' };
const inputAutoDelayEnabled = { checked: false };
const inputAutoDelayMinutes = { value: '30' };
const btnAutoRun = { disabled: false, innerHTML: '' };
const inputRunCount = { disabled: false, value: ${JSON.stringify(String(runCount))} };
const chrome = {
  runtime: {
    async sendMessage(message) {
      events.push({ type: 'send', message });
      return { ok: true };
    },
  },
};
const console = {
  warn(...args) {
    events.push({ type: 'warn', args });
  },
};
async function persistCurrentSettingsForAction() {
  events.push({ type: 'sync-settings' });
}
function getRunCountValue() { return ${Math.max(1, Number(runCount) || 1)}; }
function getLockedRunCountFromEmailPool() { return ${Math.max(0, Number(lockedRunCount) || 0)}; }
function shouldLockRunCountToEmailPool() { return getLockedRunCountFromEmailPool() > 0; }
function syncRunCountFromConfiguredEmailPool() {
  inputRunCount.value = String(getLockedRunCountFromEmailPool());
}
function normalizeRunCountInput() {
  const lockedRunCount = getLockedRunCountFromEmailPool();
  if (lockedRunCount > 0) {
    inputRunCount.value = String(lockedRunCount);
    return lockedRunCount;
  }
  const numeric = Number(inputRunCount.value);
  const normalized = Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : 1;
  inputRunCount.value = String(normalized);
  return normalized;
}
function usesCustomEmailPoolGenerator() { return false; }
function normalizeAutoRunThreadIntervalMinutes(value) { return Number(value) || 0; }
function shouldOfferAutoModeChoice() { return false; }
async function openAutoStartChoiceDialog() { throw new Error('should not be called'); }
function getFirstUnfinishedStep() { return 1; }
function getRunningSteps() { return []; }
function shouldWarnAutoRunFallbackRisk() { return false; }
function isAutoRunFallbackRiskPromptDismissed() { return false; }
async function openAutoRunFallbackRiskConfirmModal() { throw new Error('should not be called'); }
function setAutoRunFallbackRiskPromptDismissed() {}
function shouldWarnPlusAutoRunRisk(totalRuns, plusModeEnabled) {
  return ${JSON.stringify(Boolean(plusRiskEnabled))} && Boolean(plusModeEnabled) && Number(totalRuns) > 3;
}
function isAutoRunPlusRiskPromptDismissed() { return false; }
async function openPlusAutoRunRiskConfirmModal(totalRuns) {
  events.push({ type: 'plus-risk-modal', totalRuns });
  return {
    confirmed: ${JSON.stringify(Boolean(plusRiskConfirmed))},
    dismissPrompt: ${JSON.stringify(Boolean(plusRiskDismissPrompt))},
  };
}
function setAutoRunPlusRiskPromptDismissed(dismissed) {
  events.push({ type: 'plus-risk-dismiss', dismissed });
}
async function maybeShowPlusContributionPromptBeforeAutoRun(plusModeEnabled) {
  ${plusContributionImpl ? 'return (' + plusContributionImpl + ')(plusModeEnabled, events);' : 'return true;'}
}
function normalizeAutoDelayMinutes(value) { return Number(value) || 30; }
async function refreshContributionContentHint() {
  events.push({ type: 'refresh' });
  ${refreshImpl ? 'return (' + refreshImpl + ')();' : 'return null;'}
}
${bundle}
return {
  startAutoRunFromCurrentSettings,
  getEvents() {
    return events;
  },
};
`)();
}

test('startAutoRunFromCurrentSettings refreshes contribution content hint before starting auto run', async () => {
  const api = createApi();

  const result = await api.startAutoRunFromCurrentSettings();

  assert.equal(result, true);
  assert.deepEqual(
    api.getEvents().map((entry) => entry.type),
    ['refresh', 'sync-settings', 'send']
  );
  assert.equal(api.getEvents()[2].message.type, 'AUTO_RUN');
});

test('startAutoRunFromCurrentSettings continues auto run when contribution content refresh fails', async () => {
  const api = createApi({
    refreshImpl: 'async () => { throw new Error("refresh failed"); }',
  });

  const result = await api.startAutoRunFromCurrentSettings();
  const events = api.getEvents();

  assert.equal(result, true);
  assert.deepEqual(
    events.map((entry) => entry.type),
    ['refresh', 'warn', 'sync-settings', 'send']
  );
  assert.match(String(events[1].args[0]), /Failed to refresh contribution content hint before auto run/);
  assert.equal(events[3].message.type, 'AUTO_RUN');
});

test('startAutoRunFromCurrentSettings does not block auto run when contribution content has updates', async () => {
  const api = createApi({
    refreshImpl: `async () => ({
      promptVersion: 'questionnaire:2026-04-23T00:00:00Z',
      items: [{ slug: 'questionnaire', isVisible: true }],
    })`,
  });

  const result = await api.startAutoRunFromCurrentSettings();

  assert.equal(result, true);
  assert.deepEqual(
    api.getEvents().map((entry) => entry.type),
    ['refresh', 'sync-settings', 'send']
  );
});

test('startAutoRunFromCurrentSettings shows Plus risk warning before starting more than 3 runs', async () => {
  const api = createApi({
    runCount: 4,
    plusModeEnabled: true,
    plusRiskEnabled: true,
  });

  const result = await api.startAutoRunFromCurrentSettings();
  const events = api.getEvents();

  assert.equal(result, true);
  assert.deepEqual(
    events.map((entry) => entry.type),
    ['refresh', 'sync-settings', 'plus-risk-modal', 'send']
  );
  assert.equal(events[2].totalRuns, 4);
  assert.equal(events[3].message.payload.totalRuns, 4);
});

test('startAutoRunFromCurrentSettings sends selected manual totalRuns to background', async () => {
  const api = createApi({ runCount: 5 });

  const result = await api.startAutoRunFromCurrentSettings();
  const sendEvent = api.getEvents().find((entry) => entry.type === 'send');

  assert.equal(result, true);
  assert.equal(sendEvent.message.type, 'AUTO_RUN');
  assert.equal(sendEvent.message.payload.totalRuns, 5);
});

test('startAutoRunFromCurrentSettings sends locked pool totalRuns to background', async () => {
  const api = createApi({ runCount: 99, lockedRunCount: 4 });

  const result = await api.startAutoRunFromCurrentSettings();
  const sendEvent = api.getEvents().find((entry) => entry.type === 'send');

  assert.equal(result, true);
  assert.equal(sendEvent.message.payload.totalRuns, 4);
});

test('startAutoRunFromCurrentSettings aborts when Plus risk warning is declined', async () => {
  const api = createApi({
    runCount: 4,
    plusModeEnabled: true,
    plusRiskEnabled: true,
    plusRiskConfirmed: false,
  });

  const result = await api.startAutoRunFromCurrentSettings();

  assert.equal(result, false);
  assert.deepEqual(
    api.getEvents().map((entry) => entry.type),
    ['refresh', 'sync-settings', 'plus-risk-modal']
  );
});

test('startAutoRunFromCurrentSettings aborts when Plus contribution prompt opens contribution page', async () => {
  const api = createApi({
    plusModeEnabled: true,
    plusContributionImpl: `async (plusModeEnabled, events) => {
      events.push({ type: 'plus-contribution-modal', plusModeEnabled });
      return false;
    }`,
  });

  const result = await api.startAutoRunFromCurrentSettings();

  assert.equal(result, false);
  assert.deepEqual(
    api.getEvents().map((entry) => entry.type),
    ['refresh', 'sync-settings', 'plus-contribution-modal']
  );
  assert.equal(api.getEvents()[2].plusModeEnabled, true);
});

test('persistCurrentSettingsForAction forces a silent save even when settings are not marked dirty', async () => {
  const bundle = [
    extractFunction('waitForSettingsSaveIdle'),
    extractFunction('saveSettings'),
    extractFunction('persistCurrentSettingsForAction'),
  ].join('\n');

  const api = new Function(`
let settingsAutoSaveTimer = 123;
let clearedTimer = null;
let settingsSaveInFlight = false;
let settingsDirty = false;
let settingsSaveRevision = 0;
const saveCalls = [];
function clearTimeout(value) {
  clearedTimer = value;
}
function updateSaveButtonState() {}
function collectSettingsPayload() {
  return { luckmailApiKey: 'autofilled-key' };
}
function syncLatestState() {}
function updatePanelModeUI() {}
function updateMailProviderUI() {}
function updateButtonStates() {}
function markSettingsDirty() {}
function applySettingsState() {}
const chrome = {
  runtime: {
    async sendMessage(message) {
      saveCalls.push(message.payload);
      return { state: { luckmailApiKey: message.payload.luckmailApiKey } };
    },
  },
};
${bundle}
return {
  persistCurrentSettingsForAction,
  getSnapshot() {
    return { clearedTimer, saveCalls };
  },
};
`)();

  await api.persistCurrentSettingsForAction();
  const snapshot = api.getSnapshot();

  assert.equal(snapshot.clearedTimer, 123);
  assert.deepStrictEqual(snapshot.saveCalls, [{ luckmailApiKey: 'autofilled-key' }]);
});
