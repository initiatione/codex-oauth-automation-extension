const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (typeof start !== 'number' || start < 0) {
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

test('sidepanel exposes configurable step 6 registration wait in delay settings', () => {
  assert.match(html, /id="row-step6-registration-success-wait-seconds"/);
  assert.match(html, /id="input-step6-registration-success-wait-seconds"/);
  assert.match(html, /<span class="setting-caption">第6步等待<\/span>/);

  const inputTag = html.match(/<input[^>]*id="input-step6-registration-success-wait-seconds"[^>]*>/)?.[0] || '';
  assert.match(inputTag, /type="number"/);
  assert.match(inputTag, /value="20"/);
  assert.match(inputTag, /min="0"/);
  assert.match(inputTag, /max="300"/);
  assert.match(inputTag, /step="1"/);
  assert.ok(
    html.indexOf('id="row-step6-registration-success-wait-seconds"') > html.indexOf('id="row-auto-delay-settings"'),
    'step 6 wait row should live directly below the main delay settings row'
  );
});

test('sidepanel persists, hydrates, syncs, and locks step 6 registration wait setting', () => {
  assert.match(
    source,
    /const inputStep6RegistrationSuccessWaitSeconds = document\.getElementById\('input-step6-registration-success-wait-seconds'\);/
  );
  assert.match(source, /function normalizeStep6RegistrationSuccessWaitSecondsValue\(/);
  assert.match(source, /step6RegistrationSuccessWaitSeconds: normalizeStep6RegistrationSuccessWaitSecondsValue\(/);
  assert.match(
    source,
    /syncStep6RegistrationSuccessWaitInputFromState\(state\?\.step6RegistrationSuccessWaitSeconds\);/
  );
  assert.match(source, /inputStep6RegistrationSuccessWaitSeconds\.disabled = settingsCardLocked;/);
  assert.match(
    source,
    /message\.payload\.step6RegistrationSuccessWaitSeconds !== undefined[\s\S]*syncStep6RegistrationSuccessWaitInputFromState\(message\.payload\.step6RegistrationSuccessWaitSeconds\);/
  );
  assert.match(
    source,
    /inputStep6RegistrationSuccessWaitSeconds\??\.addEventListener\('input', \(\) => \{[\s\S]*scheduleSettingsAutoSave\(\);[\s\S]*\}\);/
  );
  assert.match(source, /step6RegistrationSuccessWaitInputDirty = true;/);
  assert.match(
    source,
    /inputStep6RegistrationSuccessWaitSeconds\??\.addEventListener\('blur', \(\) => \{[\s\S]*saveSettings\(\{ silent: true \}\)/
  );
});

test('step 6 wait sync preserves active manual input until blur or save completes', () => {
  const api = new Function(`
const DEFAULT_STEP6_REGISTRATION_SUCCESS_WAIT_SECONDS = 20;
const STEP6_REGISTRATION_SUCCESS_WAIT_MIN_SECONDS = 0;
const STEP6_REGISTRATION_SUCCESS_WAIT_MAX_SECONDS = 300;
let step6RegistrationSuccessWaitInputDirty = true;
const inputStep6RegistrationSuccessWaitSeconds = { value: '45' };
const document = { activeElement: inputStep6RegistrationSuccessWaitSeconds };
${extractFunction('normalizeStep6RegistrationSuccessWaitSecondsValue')}
${extractFunction('shouldPreserveStep6RegistrationSuccessWaitInputValue')}
${extractFunction('syncStep6RegistrationSuccessWaitInputFromState')}
return {
  inputStep6RegistrationSuccessWaitSeconds,
  syncStep6RegistrationSuccessWaitInputFromState,
  getDirty: () => step6RegistrationSuccessWaitInputDirty,
  clearFocus: () => { document.activeElement = null; },
};
`)();

  api.syncStep6RegistrationSuccessWaitInputFromState(20);
  assert.equal(api.inputStep6RegistrationSuccessWaitSeconds.value, '45');
  assert.equal(api.getDirty(), true);

  api.clearFocus();
  api.syncStep6RegistrationSuccessWaitInputFromState(20);
  assert.equal(api.inputStep6RegistrationSuccessWaitSeconds.value, '20');
});
