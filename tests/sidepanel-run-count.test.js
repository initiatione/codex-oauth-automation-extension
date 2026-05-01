const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const runCountSource = fs.readFileSync('sidepanel/run-count.js', 'utf8');
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
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
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

function createAutoRunLabelApi() {
  const bundle = extractFunction('getAutoRunLabel');

  return new Function(`
let currentAutoRun = {
  phase: 'idle',
  currentRun: 0,
  totalRuns: 1,
  attemptRun: 0,
};
${bundle}
return {
  getAutoRunLabel,
  setCurrentAutoRun(nextState) {
    currentAutoRun = { ...currentAutoRun, ...nextState };
  },
};
`)();
}

function createRunCountApi() {
  return new Function('self', `
${runCountSource}
return self.SidepanelRunCount;
`)({});
}

function createSidepanelRunCountApi({
  inputValue = '1',
  lockedRunCount = 0,
} = {}) {
  const bundle = [
    extractFunction('syncRunCountFromConfiguredEmailPool'),
    extractFunction('normalizeRunCountValue'),
    extractFunction('normalizeRunCountInput'),
    extractFunction('getRunCountValue'),
  ].join('\n');
  const runCountApi = createRunCountApi();

  return new Function('runCountUtils', `
const DEFAULT_RUN_COUNT = 1;
const inputRunCount = { value: ${JSON.stringify(String(inputValue))} };
const selectMailProvider = { value: '163' };
let currentLockedRunCount = ${Number(lockedRunCount) || 0};
function getLockedRunCountFromEmailPool() {
  return currentLockedRunCount;
}
function shouldLockRunCountToEmailPool() {
  return currentLockedRunCount > 0;
}
${bundle}
return {
  inputRunCount,
  getRunCountValue,
  normalizeRunCountInput,
  setLockedRunCount(value) {
    currentLockedRunCount = Math.max(0, Math.floor(Number(value) || 0));
  },
};
`)(runCountApi);
}

test('run count helper normalizes manual quantity values', () => {
  const api = createRunCountApi();

  assert.equal(api.normalizeRunCountValue('5'), 5);
  assert.equal(api.normalizeRunCountValue('5.9'), 5);
  assert.equal(api.normalizeRunCountValue(''), 1);
  assert.equal(api.normalizeRunCountValue('abc'), 1);
  assert.equal(api.normalizeRunCountValue('0'), 1);
  assert.equal(api.normalizeRunCountValue('-3'), 1);
});

test('run count helper writes normalized value after change or blur', () => {
  const api = createRunCountApi();
  const input = { value: '4.8' };

  assert.equal(api.writeNormalizedRunCount(input), 4);
  assert.equal(input.value, '4');

  input.value = '';
  assert.equal(api.writeNormalizedRunCount(input), 1);
  assert.equal(input.value, '1');
});

test('sidepanel getRunCountValue keeps manual multi-run quantity when unlocked', () => {
  const api = createSidepanelRunCountApi({ inputValue: '5' });

  assert.equal(api.getRunCountValue(), 5);
  assert.equal(api.inputRunCount.value, '5');
});

test('sidepanel normalizeRunCountInput permits editing until change or blur', () => {
  const api = createSidepanelRunCountApi({ inputValue: '' });

  assert.equal(api.inputRunCount.value, '');
  assert.equal(api.normalizeRunCountInput(), 1);
  assert.equal(api.inputRunCount.value, '1');
});

test('sidepanel run count uses locked custom pool count before manual value', () => {
  const api = createSidepanelRunCountApi({
    inputValue: '99',
    lockedRunCount: 3,
  });

  assert.equal(api.getRunCountValue(), 3);
  assert.equal(api.normalizeRunCountInput(), 3);
  assert.equal(api.inputRunCount.value, '3');

  api.setLockedRunCount(0);
  api.inputRunCount.value = '7';
  assert.equal(api.getRunCountValue(), 7);
});

test('sidepanel auto-run label preserves current and total run counts', () => {
  const api = createAutoRunLabelApi();

  assert.equal(api.getAutoRunLabel({ phase: 'scheduled', totalRuns: 5 }), ' (5轮)');
  assert.equal(api.getAutoRunLabel({
    phase: 'running',
    currentRun: 2,
    totalRuns: 5,
    attemptRun: 1,
  }), ' (2/5 · 尝试1)');
  assert.equal(api.getAutoRunLabel({
    phase: 'retrying',
    currentRun: 2,
    totalRuns: 5,
    attemptRun: 3,
  }), ' (2/5 · 尝试3)');
});
