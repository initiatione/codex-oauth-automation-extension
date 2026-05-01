const ICLOUD_MAIL_PREFIX = '[MultiPage:icloud-mail]';
const isTopFrame = window === window.top;

console.log(ICLOUD_MAIL_PREFIX, 'Content script loaded on', location.href, 'frame:', isTopFrame ? 'top' : 'child');

function isMailApplicationFrame() {
  if (/\/applications\/mail2\//.test(location.pathname)) {
    return true;
  }
  return Boolean(document.querySelector('.content-container, .mail-message-defaults, .thread-participants'));
}

if (isTopFrame) {
  console.log(ICLOUD_MAIL_PREFIX, 'Top frame detected; waiting for mail iframe.');
} else {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'POLL_EMAIL') {
      if (!isMailApplicationFrame()) {
        sendResponse({ ok: false, reason: 'wrong-frame' });
        return;
      }
      resetStopState();
      handlePollEmail(message.step, message.payload).then((result) => {
        sendResponse(result);
      }).catch((err) => {
        if (isStopError(err)) {
          log(`步骤 ${message.step}：已被用户停止。`, 'warn');
          sendResponse({ stopped: true, error: err.message });
          return;
        }
        log(`步骤 ${message.step}：iCloud 邮箱轮询失败：${err.message}`, 'warn');
        sendResponse({ error: err.message });
      });
      return true;
    }
  });

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isVisibleElement(node) {
    return Boolean(node instanceof HTMLElement)
      && (Boolean(node.offsetParent) || getComputedStyle(node).position === 'fixed');
  }

  function collectThreadItems() {
    return Array.from(document.querySelectorAll('.content-container')).filter((item) => {
      if (!isVisibleElement(item)) return false;
      return item.querySelector('.thread-participants')
        && item.querySelector('.thread-subject')
        && item.querySelector('.thread-preview');
    });
  }

  function getThreadItemMetadata(item) {
    const sender = normalizeText(item.querySelector('.thread-participants')?.textContent || '');
    const subject = normalizeText(item.querySelector('.thread-subject')?.textContent || '');
    const preview = normalizeText(item.querySelector('.thread-preview')?.textContent || '');
    const timestamp = normalizeText(item.querySelector('.thread-timestamp')?.textContent || '');
    return {
      sender,
      subject,
      preview,
      timestamp,
      combinedText: normalizeText([sender, subject, preview, timestamp].filter(Boolean).join(' ')),
    };
  }

  function parseIcloudMeridiemHour(hour, meridiem = '') {
    let nextHour = Math.max(0, Math.min(23, Number(hour) || 0));
    const normalizedMeridiem = normalizeText(meridiem).toLowerCase();
    if (/下午|晚上|pm|p\.m\./i.test(normalizedMeridiem) && nextHour < 12) {
      nextHour += 12;
    }
    if (/上午|凌晨|am|a\.m\./i.test(normalizedMeridiem) && nextHour === 12) {
      nextHour = 0;
    }
    return nextHour;
  }

  function parseIcloudTimestamp(value, now = Date.now()) {
    const text = normalizeText(value);
    if (!text) return null;

    const lowerText = text.toLowerCase();
    if (/^(刚刚|just now|moments ago|now)$/i.test(lowerText)) {
      return now;
    }

    const relativeMatch = lowerText.match(/(\d+)\s*(秒|second|seconds|sec|secs|分钟|分|min|mins|minute|minutes|小时|hour|hours|hr|hrs|天|日|day|days)\s*(前|ago)?/i);
    if (relativeMatch) {
      const amount = Math.max(0, Number(relativeMatch[1]) || 0);
      const unit = relativeMatch[2];
      const unitMs = /秒|second|sec/i.test(unit)
        ? 1000
        : (/分钟|分|min/i.test(unit)
          ? 60 * 1000
          : (/小时|hour|hr/i.test(unit) ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
      return now - amount * unitMs;
    }

    const calendarMatch = text.match(/(\d{4})[年\/\-.](\d{1,2})[月\/\-.](\d{1,2})(?:日)?(?:\s*(上午|下午|晚上|凌晨|AM|PM|A\.M\.|P\.M\.)?\s*(\d{1,2})[:：](\d{2}))?/i);
    if (calendarMatch) {
      const year = Number(calendarMatch[1]);
      const month = Number(calendarMatch[2]) - 1;
      const day = Number(calendarMatch[3]);
      const hour = calendarMatch[5] ? parseIcloudMeridiemHour(calendarMatch[5], calendarMatch[4]) : 0;
      const minute = calendarMatch[6] ? Number(calendarMatch[6]) : 0;
      const timestamp = new Date(year, month, day, hour, minute, 0, 0).getTime();
      return Number.isFinite(timestamp) ? timestamp : null;
    }

    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    const timeMatch = text.match(/(上午|下午|晚上|凌晨|AM|PM|A\.M\.|P\.M\.)?\s*(\d{1,2})[:：](\d{2})/i);
    if (timeMatch) {
      const base = new Date(now);
      const hour = parseIcloudMeridiemHour(timeMatch[2], timeMatch[1]);
      const minute = Number(timeMatch[3]);
      base.setHours(hour, minute, 0, 0);
      let timestamp = base.getTime();
      if (timestamp - now > 2 * 60 * 1000) {
        timestamp -= 24 * 60 * 60 * 1000;
      }
      return Number.isFinite(timestamp) ? timestamp : null;
    }

    return null;
  }

  function isNearVerificationRequestTime(timestampMs, filterAfterTimestamp, now = Date.now()) {
    const parsedTimestamp = Number(timestampMs);
    const requestTimestamp = Number(filterAfterTimestamp);
    if (!Number.isFinite(parsedTimestamp) || !Number.isFinite(requestTimestamp) || requestTimestamp <= 0) {
      return false;
    }
    return parsedTimestamp >= requestTimestamp - 60 * 1000
      && parsedTimestamp <= now + 2 * 60 * 1000;
  }

  function buildVerificationMailFilters(payload = {}) {
    const senderFilters = Array.isArray(payload.senderFilters) ? payload.senderFilters : [];
    const subjectFilters = Array.isArray(payload.subjectFilters) ? payload.subjectFilters : [];
    return {
      sender: senderFilters.map((filter) => String(filter || '').toLowerCase()).filter(Boolean),
      subject: subjectFilters.map((filter) => String(filter || '').toLowerCase()).filter(Boolean),
    };
  }

  function doesThreadMetadataMatchFilters(meta, filters) {
    const lowerSender = meta.sender.toLowerCase();
    const lowerSubject = normalizeText([meta.subject, meta.preview].join(' ')).toLowerCase();
    const senderMatch = filters.sender.some((filter) => lowerSender.includes(filter));
    const subjectMatch = filters.subject.some((filter) => lowerSubject.includes(filter));
    return { senderMatch, subjectMatch, matched: senderMatch || subjectMatch };
  }

  function doesOpenedMailMatchFilters(opened, filters, fallbackMatch = {}) {
    const openedSender = normalizeText(opened?.sender || '').toLowerCase();
    const openedBody = normalizeText(opened?.bodyText || opened?.combinedText || '').toLowerCase();
    const openedSenderMatch = filters.sender.some((filter) => openedSender.includes(filter));
    const openedSubjectMatch = filters.subject.some((filter) => openedBody.includes(filter));
    return openedSenderMatch || openedSubjectMatch || Boolean(fallbackMatch.senderMatch || fallbackMatch.subjectMatch);
  }

  function findNewestMatchingThreadItem(filters) {
    for (const item of collectThreadItems()) {
      const meta = getThreadItemMetadata(item);
      const match = doesThreadMetadataMatchFilters(meta, filters);
      if (match.matched) {
        return { item, meta, match };
      }
    }
    return null;
  }

  async function tryReadNearTimeFirstPass(step, payload, filters, excludedCodeSet) {
    await refreshInbox();

    const candidate = findNewestMatchingThreadItem(filters);
    if (!candidate) {
      return null;
    }

    const { item, meta, match } = candidate;
    let parsedTimestamp = parseIcloudTimestamp(meta.timestamp);
    let opened = null;

    if (parsedTimestamp !== null && !isNearVerificationRequestTime(parsedTimestamp, payload.filterAfterTimestamp)) {
      log(`步骤 ${step}：首封匹配邮件时间不在当前验证码请求窗口内，继续按旧邮件快照逻辑轮询。`, 'info');
      return null;
    }

    let code = extractVerificationCode(meta.combinedText);

    if (parsedTimestamp === null || !code) {
      opened = await openMailItemAndRead(item);
      if (!doesOpenedMailMatchFilters(opened, filters, match)) {
        return null;
      }
      if (parsedTimestamp === null) {
        parsedTimestamp = parseIcloudTimestamp(opened.timestamp);
        if (!isNearVerificationRequestTime(parsedTimestamp, payload.filterAfterTimestamp)) {
          log(`步骤 ${step}：首封匹配邮件打开后仍无法确认属于当前验证码请求窗口，继续按旧邮件快照逻辑轮询。`, 'info');
          return null;
        }
      }
      code = extractVerificationCode(opened.combinedText);
    }

    if (!code) {
      return null;
    }
    if (excludedCodeSet.has(code)) {
      log(`步骤 ${step}：首轮近时邮件包含排除的验证码：${code}，继续轮询。`, 'info');
      return null;
    }

    log(`步骤 ${step}：首轮刷新后已找到近时验证码：${code}`, 'ok');
    return {
      ok: true,
      code,
      emailTimestamp: parsedTimestamp,
      preview: (opened?.combinedText || meta.combinedText).slice(0, 160),
    };
  }

  function buildItemSignature(item) {
    const meta = getThreadItemMetadata(item);
    return normalizeText([
      item.getAttribute('aria-label') || '',
      meta.sender,
      meta.subject,
      meta.preview,
      meta.timestamp,
    ].join('::')).slice(0, 240);
  }

  function extractVerificationCode(text) {
    const matchCn = text.match(/(?:代码为|验证码[^0-9]*?)[\s：:]*(\d{6})/);
    if (matchCn) return matchCn[1];

    const matchOpenAiLogin = text.match(/(?:chatgpt\s+log-?in\s+code|enter\s+this\s+code)[^0-9]{0,24}(\d{6})/i);
    if (matchOpenAiLogin) return matchOpenAiLogin[1];

    const matchEn = text.match(/code[:\s]+is[:\s]+(\d{6})|code[:\s]+(\d{6})/i);
    if (matchEn) return matchEn[1] || matchEn[2];

    const match6 = text.match(/\b(\d{6})\b/);
    if (match6) return match6[1];

    return null;
  }

  function readOpenedMailHeader() {
    const headerRoot = document.querySelector('.ic-efwqa7');
    if (!headerRoot) {
      return { sender: '', recipients: '', timestamp: '' };
    }

    const contactValues = Array.from(headerRoot.querySelectorAll('.contact-token .ic-x1z554'))
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean);
    const sender = contactValues[0] || '';
    const recipients = contactValues.slice(1).join(' ');
    const timestamp = normalizeText(headerRoot.querySelector('.ic-rffsj8')?.textContent || '');
    return { sender, recipients, timestamp };
  }

  function getOpenedMailBodyRoot() {
    return document.querySelector('.mail-message-defaults, .pane.thread-detail-pane');
  }

  function readOpenedMailBody() {
    const bodyRoot = getOpenedMailBodyRoot();
    return normalizeText(bodyRoot?.innerText || bodyRoot?.textContent || '');
  }

  function getThreadListItemRoot(item) {
    return item?.closest?.('.thread-list-item, [role="treeitem"]') || null;
  }

  function isThreadItemSelected(item, expectedSignature = '') {
    const expected = normalizeText(expectedSignature);
    const candidates = collectThreadItems();
    const matchedItem = expected
      ? candidates.find((candidate) => buildItemSignature(candidate) === expected)
      : item;
    const root = getThreadListItemRoot(matchedItem || item);
    if (!root) {
      return false;
    }
    if (root.getAttribute('aria-selected') === 'true') {
      return true;
    }
    const className = String(root.className || '').toLowerCase();
    return /\b(selected|current|active)\b/.test(className);
  }

  function openedMailMatchesExpectedContent(expectedMeta = {}, header = null, bodyText = '') {
    const expectedSender = normalizeText(expectedMeta.sender || '').toLowerCase();
    const expectedSubject = normalizeText(expectedMeta.subject || '').toLowerCase();
    const combined = normalizeText([
      header?.sender || '',
      header?.recipients || '',
      header?.timestamp || '',
      bodyText || '',
    ].join(' ')).toLowerCase();

    if (expectedSender && combined.includes(expectedSender)) {
      return true;
    }
    if (expectedSubject && combined.includes(expectedSubject)) {
      return true;
    }
    return false;
  }

  async function waitForOpenedMailContent(item, expectedMeta = {}, timeout = 10000) {
    const expectedSignature = buildItemSignature(item);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      throwIfStopped();
      const headerRoot = document.querySelector('.ic-efwqa7');
      const bodyRoot = getOpenedMailBodyRoot();
      const selected = isThreadItemSelected(item, expectedSignature);
      if (selected && (headerRoot || bodyRoot)) {
        const header = readOpenedMailHeader();
        const bodyText = normalizeText(bodyRoot?.innerText || bodyRoot?.textContent || '');
        if (openedMailMatchesExpectedContent(expectedMeta, header, bodyText)) {
          return { headerRoot, bodyRoot };
        }
      }
      await sleep(100);
    }
    throw new Error('打开邮件后未找到详情区域，请确认邮件内容已加载。');
  }

  async function openMailItemAndRead(item) {
    const expectedMeta = getThreadItemMetadata(item);
    simulateClick(item);

    const { bodyRoot } = await waitForOpenedMailContent(item, expectedMeta, 10000);
    await sleep(300);

    const header = readOpenedMailHeader();
    const bodyText = normalizeText(
      bodyRoot?.innerText || bodyRoot?.textContent || readOpenedMailBody()
    );
    return {
      ...header,
      bodyText,
      combinedText: normalizeText([header.sender, header.recipients, header.timestamp, bodyText].filter(Boolean).join(' ')),
    };
  }

  async function refreshInbox() {
    const refreshPatterns = [/刷新/i, /refresh/i, /重新载入/i];
    const candidates = document.querySelectorAll('button, [role="button"], a');
    for (const node of candidates) {
      const text = normalizeText(node.innerText || node.textContent || '');
      const label = normalizeText(node.getAttribute('aria-label') || node.getAttribute('title') || '');
      if (refreshPatterns.some((pattern) => pattern.test(text) || pattern.test(label))) {
        simulateClick(node);
        await sleep(1000);
        return;
      }
    }

    const inboxPatterns = [/收件箱/, /inbox/i];
    for (const node of candidates) {
      const text = normalizeText(node.innerText || node.textContent || '');
      const label = normalizeText(node.getAttribute('aria-label') || node.getAttribute('title') || '');
      if (inboxPatterns.some((pattern) => pattern.test(text) || pattern.test(label))) {
        simulateClick(node);
        await sleep(1000);
        return;
      }
    }
  }

  async function handlePollEmail(step, payload) {
    const { senderFilters, subjectFilters, maxAttempts, intervalMs, excludeCodes = [] } = payload;
    const excludedCodeSet = new Set(excludeCodes.filter(Boolean));
    const FALLBACK_AFTER = 3;
    const filters = buildVerificationMailFilters({ senderFilters, subjectFilters });

    log(`步骤 ${step}：开始轮询 iCloud 邮箱（最多 ${maxAttempts} 次）`);
    await waitForElement('.content-container', 10000);

    const firstPassResult = await tryReadNearTimeFirstPass(step, payload, filters, excludedCodeSet);
    if (firstPassResult?.code) {
      return firstPassResult;
    }

    await sleep(1500);

    const existingSignatures = new Set(collectThreadItems().map(buildItemSignature));
    log(`步骤 ${step}：已记录当前 ${existingSignatures.size} 封旧邮件快照`);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      log(`步骤 ${step}：正在轮询 iCloud 邮箱，第 ${attempt}/${maxAttempts} 次`);

      if (attempt > 1) {
        await refreshInbox();
        await sleep(1200);
      }

      const items = collectThreadItems();
      const useFallback = attempt > FALLBACK_AFTER;

      for (const item of items) {
        const signature = buildItemSignature(item);
        if (!useFallback && existingSignatures.has(signature)) {
          continue;
        }

        const meta = getThreadItemMetadata(item);
        const match = doesThreadMetadataMatchFilters(meta, filters);

        if (!match.matched) {
          continue;
        }

        let code = extractVerificationCode(meta.combinedText);
        let opened = null;

        if (!code) {
          opened = await openMailItemAndRead(item);
          if (!doesOpenedMailMatchFilters(opened, filters, match)) {
            continue;
          }
          code = extractVerificationCode(opened.combinedText);
        }

        if (!code) {
          continue;
        }
        if (excludedCodeSet.has(code)) {
          log(`步骤 ${step}：跳过排除的验证码：${code}`, 'info');
          continue;
        }

        const source = useFallback && existingSignatures.has(signature) ? '回退匹配邮件' : '新邮件';
        log(`步骤 ${step}：已找到验证码：${code}（来源：${source}）`, 'ok');
        return {
          ok: true,
          code,
          emailTimestamp: Date.now(),
          preview: (opened?.combinedText || meta.combinedText).slice(0, 160),
        };
      }

      if (attempt === FALLBACK_AFTER + 1) {
        log(`步骤 ${step}：连续 ${FALLBACK_AFTER} 次未发现新邮件，开始回退到首封匹配邮件`, 'warn');
      }

      if (attempt < maxAttempts) {
        await sleep(intervalMs);
      }
    }

    throw new Error(
      `${Math.round((maxAttempts * intervalMs) / 1000)} 秒后仍未在 iCloud 邮箱中找到新的匹配邮件。请手动检查收件箱。`
    );
  }
}
