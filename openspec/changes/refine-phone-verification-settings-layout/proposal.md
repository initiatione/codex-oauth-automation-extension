## Why

The sidepanel `接码设置` area has grown with HeroSMS, reuse, risk, and runtime controls, and the current proportions leave uneven whitespace, crowded runtime rows, and inconsistent control alignment. A compact layout pass is needed so operators can scan and adjust phone-verification settings quickly without changing SMS behavior.

## What Changes

- Reorganize the expanded phone-verification panel into clearer visual groups for platform/country/API basics, acquisition/price strategy, SMS wait parameters, reuse/risk switches, and runtime/free-reuse state.
- Normalize two-column proportions so labels, numeric inputs, units, selects, toggles, and action buttons align predictably across the `接码设置` card.
- Make runtime status rows easier to read, especially `当前分配`, `验证码`, and `白嫖号码`, while keeping the manual phone fallback input compact.
- Reduce oversized blank areas and right-column drift in the HeroSMS settings grid.
- Preserve all existing control IDs, persisted settings, hot-update behavior, Step 9 behavior, and HeroSMS API semantics.

## Capabilities

### New Capabilities
- `phone-verification-settings-layout`: Covers the sidepanel layout contract for the expanded phone-verification / HeroSMS settings area.

### Modified Capabilities
- None. This change is UI layout only and does not alter phone verification, free reuse, paid reactivation, banned-number replacement, or timeout behavior requirements.

## Impact

- Affected UI: `sidepanel/sidepanel.html` and `sidepanel/sidepanel.css`, focused on the `接码设置` / HeroSMS section.
- Affected tests: sidepanel HTML/CSS structure tests should verify the grouped layout hooks and existing controls remain present.
- Affected docs: `项目完整链路说明.md` may mention the grouped `接码设置` layout if implementation changes user-visible organization. `项目文件结构说明.md` and `项目开发规范（AI协作）.md` should not need updates because the change does not alter project structure or development boundaries.
- Affected configuration domain: phone-verification configuration UI only; no storage keys, defaults, import/export schema, provider APIs, or Step 9 runtime semantics should change.
