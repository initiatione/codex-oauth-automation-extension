const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/phone-auth.js', 'utf8');
const globalScope = { navigator: { language: 'zh-CN' } };
const api = new Function('self', `${source}; return self.MultiPagePhoneAuth;`)(globalScope);

function createFakeAddPhoneDom() {
  const selectEvents = [];
  const hiddenInputEvents = [];
  let submitClicked = false;

  const options = [
    { value: 'US', textContent: '美国' },
    { value: 'TH', textContent: '泰国' },
  ];

  const select = {
    options,
    selectedIndex: 0,
    dispatchEvent(event) {
      selectEvents.push(event?.type || '');
      return true;
    },
  };

  Object.defineProperty(select, 'value', {
    get() {
      return options[select.selectedIndex]?.value || '';
    },
    set(nextValue) {
      const nextIndex = options.findIndex((option) => option.value === String(nextValue || ''));
      if (nextIndex >= 0) {
        select.selectedIndex = nextIndex;
      }
    },
  });

  const phoneInput = {
    value: '',
    type: 'tel',
    dispatchEvent() {
      return true;
    },
    closest() {
      return null;
    },
  };

  const hiddenPhoneInput = {
    value: '',
    dispatchEvent(event) {
      hiddenInputEvents.push(event?.type || '');
      return true;
    },
  };

  const selectValueNode = {
    get textContent() {
      return select.value === 'TH' ? '泰国 (+66)' : '美国 (+1)';
    },
  };

  const countryButton = {
    querySelector(selector) {
      return selector === '.react-aria-SelectValue' ? selectValueNode : null;
    },
    get textContent() {
      return selectValueNode.textContent;
    },
  };

  const submitButton = {
    type: 'submit',
    click() {
      submitClicked = true;
    },
  };

  const form = {
    querySelector(selector) {
      switch (selector) {
        case 'select':
          return select;
        case 'input[type="tel"], input[name="__reservedForPhoneNumberInput_tel"], input[autocomplete="tel"]':
          return phoneInput;
        case 'input[name="phoneNumber"]':
          return hiddenPhoneInput;
        case 'button[aria-haspopup="listbox"]':
          return countryButton;
        default:
          return null;
      }
    },
    querySelectorAll(selector) {
      if (selector === 'button[type="submit"], input[type="submit"]') {
        return [submitButton];
      }
      return [];
    },
  };

  const document = {
    documentElement: {
      lang: 'zh-CN',
      getAttribute(name) {
        return name === 'lang' ? 'zh-CN' : '';
      },
    },
    querySelector(selector) {
      if (selector === 'form[action*="/add-phone" i]') {
        return form;
      }
      return null;
    },
  };

  return {
    document,
    hiddenInputEvents,
    hiddenPhoneInput,
    phoneInput,
    select,
    selectEvents,
    submitButton,
    wasSubmitClicked: () => submitClicked,
  };
}

function createFakePhoneVerificationDom() {
  let resendClicked = false;
  const resendButton = {
    disabled: false,
    textContent: '重新发送短信',
    click() {
      resendClicked = true;
    },
    getAttribute(name) {
      return name === 'value' ? 'resend' : '';
    },
  };

  const form = {
    querySelectorAll(selector) {
      if (selector === 'button, input[type="submit"], input[type="button"]') {
        return [resendButton];
      }
      return [];
    },
  };

  const document = {
    querySelector(selector) {
      if (selector === 'form[action*="/phone-verification" i]') {
        return form;
      }
      return null;
    },
  };

  return {
    document,
    wasResendClicked: () => resendClicked,
  };
}

test('phone auth matches english HeroSMS country labels against localized add-phone options', async () => {
  const originalDocument = global.document;
  const originalEvent = global.Event;
  const originalLocation = global.location;
  const OriginalDisplayNames = Intl.DisplayNames;

  const dom = createFakeAddPhoneDom();
  let phoneVerificationReady = false;

  global.document = dom.document;
  global.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };
  global.location = { href: 'https://auth.openai.com/add-phone' };
  Intl.DisplayNames = class DisplayNames {
    of(regionCode) {
      if (regionCode === 'TH') return 'Thailand';
      if (regionCode === 'US') return 'United States';
      return regionCode;
    }
  };

  try {
    const helpers = api.createPhoneAuthHelpers({
      fillInput: (element, value) => {
        element.value = value;
      },
      getActionText: () => '',
      getPageTextSnapshot: () => '',
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => true,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => phoneVerificationReady,
      isVisibleElement: () => true,
      simulateClick: (element) => {
        element.click?.();
        phoneVerificationReady = true;
        global.location.href = 'https://auth.openai.com/phone-verification';
      },
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    const result = await helpers.submitPhoneNumber({
      countryLabel: 'Thailand',
      phoneNumber: '66959916439',
    });

    assert.equal(dom.select.value, 'TH');
    assert.deepStrictEqual(dom.selectEvents, ['input', 'change']);
    assert.equal(dom.phoneInput.value, '959916439');
    assert.equal(dom.hiddenPhoneInput.value, '+66959916439');
    assert.deepStrictEqual(dom.hiddenInputEvents, ['input', 'change']);
    assert.equal(dom.wasSubmitClicked(), true);
    assert.deepStrictEqual(result, {
      phoneVerificationPage: true,
      displayedPhone: '',
      url: 'https://auth.openai.com/phone-verification',
    });
  } finally {
    global.document = originalDocument;
    global.Event = originalEvent;
    global.location = originalLocation;
    Intl.DisplayNames = OriginalDisplayNames;
  }
});

test('phone auth reports banned-number error after resend click', async () => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  const dom = createFakePhoneVerificationDom();
  let pageText = '';

  global.document = dom.document;
  global.location = { href: 'https://auth.openai.com/phone-verification' };

  try {
    const helpers = api.createPhoneAuthHelpers({
      fillInput: () => {},
      getActionText: (element) => element?.textContent || '',
      getPageTextSnapshot: () => pageText,
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => false,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => true,
      isVisibleElement: () => true,
      simulateClick: (element) => {
        element.click?.();
        pageText = '无法向此电话号码发送短信';
      },
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    await assert.rejects(
      () => helpers.resendPhoneVerificationCode(1000),
      /PHONE_RESEND_BANNED_NUMBER::无法向此电话号码发送短信/
    );
    assert.equal(dom.wasResendClicked(), true);
  } finally {
    global.document = originalDocument;
    global.location = originalLocation;
  }
});

test('phone auth read-only resend probe reports banned-number text', async () => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  const dom = createFakePhoneVerificationDom();

  global.document = dom.document;
  global.location = { href: 'https://auth.openai.com/phone-verification' };

  try {
    const helpers = api.createPhoneAuthHelpers({
      fillInput: () => {},
      getActionText: (element) => element?.textContent || '',
      getPageTextSnapshot: () => '无法向此电话号码发送短信',
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => false,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => true,
      isVisibleElement: () => true,
      simulateClick: () => {},
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    assert.deepStrictEqual(helpers.checkPhoneResendError(), {
      hasError: true,
      reason: 'resend_phone_banned',
      prefix: 'PHONE_RESEND_BANNED_NUMBER::',
      message: '无法向此电话号码发送短信',
      url: 'https://auth.openai.com/phone-verification',
    });
    assert.equal(dom.wasResendClicked(), false);
  } finally {
    global.document = originalDocument;
    global.location = originalLocation;
  }
});

test('phone auth still reports normal resend success when no resend error appears', async () => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  const dom = createFakePhoneVerificationDom();

  global.document = dom.document;
  global.location = { href: 'https://auth.openai.com/phone-verification' };

  try {
    const helpers = api.createPhoneAuthHelpers({
      fillInput: () => {},
      getActionText: (element) => element?.textContent || '',
      getPageTextSnapshot: () => '',
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => false,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => true,
      isVisibleElement: () => true,
      simulateClick: (element) => element.click?.(),
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    const result = await helpers.resendPhoneVerificationCode(1000);

    assert.deepStrictEqual(result, {
      resent: true,
      url: 'https://auth.openai.com/phone-verification',
    });
    assert.equal(dom.wasResendClicked(), true);
  } finally {
    global.document = originalDocument;
    global.location = originalLocation;
  }
});

test('phone auth still reports resend throttling separately from banned number', async () => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  const dom = createFakePhoneVerificationDom();
  let pageText = '';

  global.document = dom.document;
  global.location = { href: 'https://auth.openai.com/phone-verification' };

  try {
    const helpers = api.createPhoneAuthHelpers({
      fillInput: () => {},
      getActionText: (element) => element?.textContent || '',
      getPageTextSnapshot: () => pageText,
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => false,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => true,
      isVisibleElement: () => true,
      simulateClick: (element) => {
        element.click?.();
        pageText = 'Tried to resend too many times. Please try again later.';
      },
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    await assert.rejects(
      () => helpers.resendPhoneVerificationCode(1000),
      /PHONE_RESEND_THROTTLED::Tried to resend too many times/
    );
  } finally {
    global.document = originalDocument;
    global.location = originalLocation;
  }
});

test('phone auth read-only resend probe reports throttled text', async () => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  const dom = createFakePhoneVerificationDom();

  global.document = dom.document;
  global.location = { href: 'https://auth.openai.com/phone-verification' };

  try {
    const helpers = api.createPhoneAuthHelpers({
      fillInput: () => {},
      getActionText: (element) => element?.textContent || '',
      getPageTextSnapshot: () => 'Tried to resend too many times. Please try again later.',
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => false,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => true,
      isVisibleElement: () => true,
      simulateClick: () => {},
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    const result = helpers.checkPhoneResendError();
    assert.equal(result.hasError, true);
    assert.equal(result.reason, 'resend_throttled');
    assert.equal(result.prefix, 'PHONE_RESEND_THROTTLED::');
    assert.match(result.message, /Tried to resend too many times/i);
    assert.equal(dom.wasResendClicked(), false);
  } finally {
    global.document = originalDocument;
    global.location = originalLocation;
  }
});
