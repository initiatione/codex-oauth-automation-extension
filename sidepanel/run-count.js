(function attachSidepanelRunCount(globalScope) {
  const DEFAULT_MIN_RUN_COUNT = 1;

  function normalizeRunCountValue(value, options = {}) {
    const min = Math.max(1, Math.floor(Number(options.min) || DEFAULT_MIN_RUN_COUNT));
    const fallback = Math.max(min, Math.floor(Number(options.fallback) || min));
    const maxOption = Number(options.max);
    const max = Number.isFinite(maxOption) && maxOption >= min
      ? Math.floor(maxOption)
      : Number.MAX_SAFE_INTEGER;
    const text = String(value ?? '').trim();
    const numeric = text ? Number(text) : NaN;
    const normalized = Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
    return Math.min(max, Math.max(min, normalized));
  }

  function writeNormalizedRunCount(input, options = {}) {
    const normalized = normalizeRunCountValue(input?.value, options);
    if (input) {
      input.value = String(normalized);
    }
    return normalized;
  }

  globalScope.SidepanelRunCount = {
    normalizeRunCountValue,
    writeNormalizedRunCount,
  };
})(typeof self !== 'undefined' ? self : globalThis);

