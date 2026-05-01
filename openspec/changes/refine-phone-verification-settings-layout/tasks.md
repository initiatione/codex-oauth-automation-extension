## 1. Layout Structure

- [x] 1.1 Review the current `sidepanel/sidepanel.html` phone-verification fold and map every existing HeroSMS control ID before editing.
- [x] 1.2 Add semantic layout wrappers/classes for platform basics, acquisition strategy, SMS timing, reuse/risk, and runtime state without renaming existing IDs.
- [x] 1.3 Keep the `白嫖号码` manual fallback controls in the runtime group while separating value display, input, and actions enough to wrap safely.

## 2. Responsive Styling

- [x] 2.1 Update `sidepanel/sidepanel.css` so the phone-verification groups use balanced grid proportions at normal sidepanel width.
- [x] 2.2 Normalize compact widths and alignment for numeric inputs, unit labels, toggles, selects, and action buttons.
- [x] 2.3 Add narrow-width rules so two-column settings collapse or wrap cleanly when the sidepanel is small.
- [x] 2.4 Fix runtime-state layout so `当前分配`, `验证码`, `白嫖号码`, manual phone input, `记录`, and `清除` never overlap at narrow widths.

## 3. Behavior Preservation

- [x] 3.1 Confirm `sidepanel.js` selectors, state rendering, save/clear free reusable phone handlers, and phone-verification setting updates still target the same element IDs.
- [x] 3.2 Confirm no storage keys, defaults, import/export behavior, background routing, Step 9 logic, or HeroSMS API calls are changed by the layout work.

## 4. Tests and Verification

- [x] 4.1 Extend sidepanel tests to assert the new phone-verification layout hooks exist while all existing controls remain present.
- [x] 4.2 Run `node --test tests\sidepanel-phone-verification-settings.test.js`.
- [x] 4.3 Run full `npm test`.
- [x] 4.4 Run `openspec validate refine-phone-verification-settings-layout --strict`.
- [x] 4.5 Check touched Chinese HTML/CSS/docs text for mojibake.
- [x] 4.6 If practical, open the sidepanel or rendered HTML at a narrow width and verify the `接码设置` runtime rows do not overlap visually.

## 5. Documentation

- [x] 5.1 Update `项目完整链路说明.md` only if the implemented layout grouping needs a user-visible note.
- [x] 5.2 Leave `项目文件结构说明.md` and `项目开发规范（AI协作）.md` unchanged unless implementation introduces new files or development boundaries.
