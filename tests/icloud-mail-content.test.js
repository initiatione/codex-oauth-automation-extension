const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/icloud-mail.js', 'utf8');

function extractFunction(name) {
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

test('readOpenedMailBody falls back to thread detail pane and extracts verification code', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('extractVerificationCode'),
    extractFunction('getOpenedMailBodyRoot'),
    extractFunction('readOpenedMailBody'),
  ].join('\n');

  const api = new Function(`
const detailPane = {
  innerText: '此邮件包含远程内容。 你的 ChatGPT 代码为 731091 输入此临时验证码以继续：731091',
  textContent: '此邮件包含远程内容。 你的 ChatGPT 代码为 731091 输入此临时验证码以继续：731091',
};
const document = {
  querySelector(selector) {
    if (selector.includes('.pane.thread-detail-pane')) {
      return detailPane;
    }
    return null;
  },
};
${bundle}
return { readOpenedMailBody, extractVerificationCode };
`)();

  const bodyText = api.readOpenedMailBody();
  assert.match(bodyText, /731091/);
  assert.equal(api.extractVerificationCode(bodyText), '731091');
});

test('extractVerificationCode matches the new suspicious log-in mail body', () => {
  const bundle = [
    extractFunction('extractVerificationCode'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { extractVerificationCode };
`)();

  const bodyText = 'ChatGPT Log-in Code\nWe noticed a suspicious log-in on your account. If that was you, enter this code:\n\n982219';
  assert.equal(api.extractVerificationCode(bodyText), '982219');
});

test('readOpenedMailBody ignores conversation list rows when no detail pane is open', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getOpenedMailBodyRoot'),
    extractFunction('readOpenedMailBody'),
  ].join('\n');

  const api = new Function(`
const document = {
  querySelector(selector) {
    if (selector === '.mail-message-defaults, .pane.thread-detail-pane') {
      return null;
    }
    throw new Error('unexpected selector: ' + selector);
  },
};
${bundle}
return { readOpenedMailBody };
`)();

  assert.equal(api.readOpenedMailBody(), '');
});

test('isThreadItemSelected follows the selected thread-list-item instead of the content container itself', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getThreadItemMetadata'),
    extractFunction('buildItemSignature'),
    extractFunction('getThreadListItemRoot'),
    extractFunction('isThreadItemSelected'),
  ].join('\n');

  const selectedRoot = {
    getAttribute(name) {
      return name === 'aria-selected' ? 'true' : '';
    },
    className: 'thread-list-item ic-z3c00x',
  };
  const selectedItem = {
    closest() {
      return selectedRoot;
    },
    getAttribute() {
      return '';
    },
    querySelector(selector) {
      const map = {
        '.thread-participants': { textContent: 'OpenAI' },
        '.thread-subject': { textContent: '你的 ChatGPT 代码为 731091' },
        '.thread-preview': { textContent: '输入此临时验证码以继续：731091' },
        '.thread-timestamp': { textContent: '下午1:35' },
      };
      return map[selector] || null;
    },
  };
  const staleRoot = {
    getAttribute() {
      return '';
    },
    className: 'thread-list-item ic-z3c00x',
  };
  const staleItem = {
    closest() {
      return staleRoot;
    },
    getAttribute() {
      return '';
    },
    querySelector(selector) {
      const map = {
        '.thread-participants': { textContent: 'JetBrains Sales' },
        '.thread-subject': { textContent: '旧邮件' },
        '.thread-preview': { textContent: '旧摘要' },
        '.thread-timestamp': { textContent: '2026/3/4' },
      };
      return map[selector] || null;
    },
  };

  const api = new Function(`
let threadItems = [];
function collectThreadItems() {
  return threadItems;
}
${bundle}
return {
  buildItemSignature,
  isThreadItemSelected,
  setThreadItems(next) {
    threadItems = next;
  },
};
`)();

  api.setThreadItems([selectedItem, staleItem]);
  assert.equal(api.isThreadItemSelected(staleItem, api.buildItemSignature(selectedItem)), true);
  assert.equal(api.isThreadItemSelected(staleItem, api.buildItemSignature(staleItem)), false);
});

test('parseIcloudTimestamp handles recent iCloud timestamp labels', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('parseIcloudMeridiemHour'),
    extractFunction('parseIcloudTimestamp'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { parseIcloudTimestamp };
`)();

  const now = new Date(2026, 4, 1, 23, 35, 30).getTime();
  assert.equal(api.parseIcloudTimestamp('刚刚', now), now);
  assert.equal(api.parseIcloudTimestamp('1 分钟前', now), now - 60_000);
  assert.equal(api.parseIcloudTimestamp('1 min ago', now), now - 60_000);
  assert.equal(api.parseIcloudTimestamp('下午11:34', now), new Date(2026, 4, 1, 23, 34).getTime());
  assert.equal(api.parseIcloudTimestamp('上午12:05', now), new Date(2026, 4, 1, 0, 5).getTime());
  assert.equal(api.parseIcloudTimestamp('2026/05/01 下午11:34', now), new Date(2026, 4, 1, 23, 34).getTime());
});

test('iCloud first pass refreshes before old-mail snapshot and accepts a near-time matching mail', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('parseIcloudMeridiemHour'),
    extractFunction('parseIcloudTimestamp'),
    extractFunction('isNearVerificationRequestTime'),
    extractFunction('buildVerificationMailFilters'),
    extractFunction('doesThreadMetadataMatchFilters'),
    extractFunction('doesOpenedMailMatchFilters'),
    extractFunction('findNewestMatchingThreadItem'),
    extractFunction('getThreadItemMetadata'),
    extractFunction('extractVerificationCode'),
    extractFunction('tryReadNearTimeFirstPass'),
  ].join('\n');

  const api = new Function(`
let refreshed = false;
let snapshotCount = 0;
const item = {
  getAttribute() {
    return '';
  },
  querySelector(selector) {
    const map = {
      '.thread-participants': { textContent: 'OpenAI' },
      '.thread-subject': { textContent: 'ChatGPT Log-in Code' },
      '.thread-preview': { textContent: 'Enter this code: 731091' },
      '.thread-timestamp': { textContent: '1分钟前' },
    };
    return map[selector] || null;
  },
};
function collectThreadItems() {
  if (!refreshed) return [];
  return [item];
}
async function refreshInbox() {
  refreshed = true;
}
function buildItemSignature() {
  snapshotCount += 1;
  return 'snapshot';
}
function log() {}
${bundle}
return {
  buildVerificationMailFilters,
  tryReadNearTimeFirstPass,
  get snapshotCount() {
    return snapshotCount;
  },
};
`)();

  const now = Date.now();
  const result = await api.tryReadNearTimeFirstPass(
    8,
    {
      filterAfterTimestamp: now - 90_000,
      senderFilters: ['openai'],
      subjectFilters: ['login', 'code'],
    },
    api.buildVerificationMailFilters({
      senderFilters: ['openai'],
      subjectFilters: ['login', 'code'],
    }),
    new Set()
  );

  assert.equal(result.code, '731091');
  assert.equal(api.snapshotCount, 0);
});

test('iCloud first pass rejects stale, unparseable, and excluded matching mails', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('parseIcloudMeridiemHour'),
    extractFunction('parseIcloudTimestamp'),
    extractFunction('isNearVerificationRequestTime'),
    extractFunction('buildVerificationMailFilters'),
    extractFunction('doesThreadMetadataMatchFilters'),
    extractFunction('doesOpenedMailMatchFilters'),
    extractFunction('findNewestMatchingThreadItem'),
    extractFunction('getThreadItemMetadata'),
    extractFunction('extractVerificationCode'),
    extractFunction('tryReadNearTimeFirstPass'),
  ].join('\n');

  const api = new Function(`
let currentTimestamp = '1小时前';
let currentCode = '731091';
const item = {
  getAttribute() {
    return '';
  },
  querySelector(selector) {
    const map = {
      '.thread-participants': { textContent: 'OpenAI' },
      '.thread-subject': { textContent: 'ChatGPT Log-in Code' },
      '.thread-preview': { textContent: 'Enter this code: ' + currentCode },
      '.thread-timestamp': { textContent: currentTimestamp },
    };
    return map[selector] || null;
  },
};
function collectThreadItems() {
  return [item];
}
async function refreshInbox() {}
async function openMailItemAndRead() {
  return {
    sender: 'OpenAI',
    timestamp: '昨天',
    bodyText: 'ChatGPT Log-in Code Enter this code: ' + currentCode,
    combinedText: 'OpenAI 昨天 ChatGPT Log-in Code Enter this code: ' + currentCode,
  };
}
function log() {}
${bundle}
return {
  buildVerificationMailFilters,
  tryReadNearTimeFirstPass,
  setCase(timestamp, code) {
    currentTimestamp = timestamp;
    currentCode = code;
  },
};
`)();
  const filters = api.buildVerificationMailFilters({
    senderFilters: ['openai'],
    subjectFilters: ['login', 'code'],
  });
  const basePayload = {
    filterAfterTimestamp: Date.now() - 60_000,
    senderFilters: ['openai'],
    subjectFilters: ['login', 'code'],
  };

  assert.equal(await api.tryReadNearTimeFirstPass(8, basePayload, filters, new Set()), null);

  api.setCase('昨天', '731091');
  assert.equal(await api.tryReadNearTimeFirstPass(8, basePayload, filters, new Set()), null);

  api.setCase('刚刚', '731091');
  assert.equal(await api.tryReadNearTimeFirstPass(8, basePayload, filters, new Set(['731091'])), null);
});

test('iCloud first pass can confirm an unparseable list timestamp from the opened header', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('parseIcloudMeridiemHour'),
    extractFunction('parseIcloudTimestamp'),
    extractFunction('isNearVerificationRequestTime'),
    extractFunction('buildVerificationMailFilters'),
    extractFunction('doesThreadMetadataMatchFilters'),
    extractFunction('doesOpenedMailMatchFilters'),
    extractFunction('findNewestMatchingThreadItem'),
    extractFunction('getThreadItemMetadata'),
    extractFunction('extractVerificationCode'),
    extractFunction('tryReadNearTimeFirstPass'),
  ].join('\n');

  const api = new Function(`
const item = {
  getAttribute() {
    return '';
  },
  querySelector(selector) {
    const map = {
      '.thread-participants': { textContent: 'OpenAI' },
      '.thread-subject': { textContent: 'ChatGPT Log-in Code' },
      '.thread-preview': { textContent: 'Open this email for the code' },
      '.thread-timestamp': { textContent: '今天' },
    };
    return map[selector] || null;
  },
};
function collectThreadItems() {
  return [item];
}
async function refreshInbox() {}
async function openMailItemAndRead() {
  return {
    sender: 'OpenAI',
    timestamp: '刚刚',
    bodyText: 'ChatGPT Log-in Code Enter this code: 982219',
    combinedText: 'OpenAI 刚刚 ChatGPT Log-in Code Enter this code: 982219',
  };
}
function log() {}
${bundle}
return {
  buildVerificationMailFilters,
  tryReadNearTimeFirstPass,
};
`)();

  const filters = api.buildVerificationMailFilters({
    senderFilters: ['openai'],
    subjectFilters: ['login', 'code'],
  });
  const result = await api.tryReadNearTimeFirstPass(
    8,
    {
      filterAfterTimestamp: Date.now() - 60_000,
      senderFilters: ['openai'],
      subjectFilters: ['login', 'code'],
    },
    filters,
    new Set()
  );

  assert.equal(result.code, '982219');
});

test('iCloud verification result cache keeps the current session and clears on a new session', async () => {
  const bundle = [
    extractFunction('getIcloudVerificationResultStorageKey'),
    extractFunction('buildVerificationSessionKey'),
    extractFunction('normalizeCachedVerificationResultState'),
    extractFunction('persistCachedVerificationResultState'),
    extractFunction('ensureVerificationResultSession'),
    extractFunction('cacheVerificationPollSuccess'),
  ].join('\n');

  const api = new Function(`
let cachedVerificationResultState = null;
let cachedVerificationResultReadyPromise = Promise.resolve();
let persistedState = null;
const writes = [];
const chrome = {
  storage: {
    session: {
      async get(key) {
        return { [key]: persistedState };
      },
      async set(payload) {
        persistedState = Object.prototype.hasOwnProperty.call(payload, 'icloudVerificationResultState')
          ? payload.icloudVerificationResultState
          : persistedState;
        writes.push(persistedState);
      },
      async remove() {
        persistedState = null;
        writes.push(null);
      },
    },
  },
};
${bundle}
return {
  ensureVerificationResultSession,
  cacheVerificationPollSuccess,
  getPersistedState() {
    return persistedState;
  },
  getWrites() {
    return writes.slice();
  },
};
`)();

  const firstResult = await api.cacheVerificationPollSuccess(
    8,
    { sessionKey: '8:1000' },
    { code: '654321', emailTimestamp: 123, preview: 'preview' }
  );

  assert.equal(firstResult.sessionKey, '8:1000');
  assert.deepStrictEqual(api.getPersistedState(), {
    sessionKey: '8:1000',
    step: 8,
    code: '654321',
    emailTimestamp: 123,
    preview: 'preview',
    cachedAt: api.getPersistedState().cachedAt,
  });

  await api.ensureVerificationResultSession(8, { sessionKey: '8:1000' });
  assert.equal(api.getPersistedState().sessionKey, '8:1000');

  await api.ensureVerificationResultSession(8, { sessionKey: '8:2000' });
  assert.equal(api.getPersistedState(), null);
  assert.equal(api.getWrites().at(-1), null);
});
