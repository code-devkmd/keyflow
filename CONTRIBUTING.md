# Contributing to KeyFlow Piano

Thanks for helping improve KeyFlow. The project is intentionally organized by feature so contributors can work on one part of the instrument without needing to understand the entire app.

## Local setup

```bash
cd frontend
pnpm install
pnpm dev
```

Use a supported Node.js version (`^20.19.0` or `>=22.12.0`).

## Before opening a pull request

```bash
pnpm format
pnpm typecheck
pnpm test
pnpm build
```

If you only want to verify formatting without changing files, use `pnpm format:check`.

## Code conventions

- Use TypeScript types at feature boundaries and avoid `any`.
- Choose names that explain intent (`activeMidiNotes`, not `arr` or `tmp`).
- Prefer small hooks for browser APIs and side effects, and small components for UI.
- Keep audio scheduling and voice ownership in `src/audio/`; do not put Tone.js logic in presentation components.
- Keep reusable music/keyboard logic in `src/shared/utils/` and add unit tests alongside it under `__tests__/`.
- Use the `@/` alias for source imports instead of long relative paths.
- Format with Prettier; do not hand-align whitespace or add unrelated formatting changes to functional patches.
- Respect browser permissions and autoplay rules. MIDI and audio should only activate after an explicit user action.
- Never upload recordings or MIDI files without clear user consent.

## Suggested pull request checklist

- [ ] Describe the user-visible change and why it helps.
- [ ] Add or update tests for behavior changes.
- [ ] Run formatter, typecheck, tests, and production build.
- [ ] Check keyboard-only interaction and visible focus states.
- [ ] Confirm no notes remain stuck after releasing keys, losing focus, or disconnecting a MIDI device.
- [ ] Update the README or docs if controls or setup changed.
