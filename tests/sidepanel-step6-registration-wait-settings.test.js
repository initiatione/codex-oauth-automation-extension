const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

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
    /inputStep6RegistrationSuccessWaitSeconds\.value = String\(normalizeStep6RegistrationSuccessWaitSecondsValue\(state\?\.step6RegistrationSuccessWaitSeconds\)\);/
  );
  assert.match(source, /inputStep6RegistrationSuccessWaitSeconds\.disabled = locked;/);
  assert.match(
    source,
    /message\.payload\.step6RegistrationSuccessWaitSeconds !== undefined[\s\S]*inputStep6RegistrationSuccessWaitSeconds\.value = String\(\s*normalizeStep6RegistrationSuccessWaitSecondsValue\(message\.payload\.step6RegistrationSuccessWaitSeconds\)\s*\);/
  );
  assert.match(
    source,
    /inputStep6RegistrationSuccessWaitSeconds\??\.addEventListener\('input', \(\) => \{[\s\S]*scheduleSettingsAutoSave\(\);[\s\S]*\}\);/
  );
  assert.match(
    source,
    /inputStep6RegistrationSuccessWaitSeconds\??\.addEventListener\('blur', \(\) => \{[\s\S]*saveSettings\(\{ silent: true \}\)/
  );
});
