# KeyFlow Piano

KeyFlow Piano is a browser-based instrument built with React, TypeScript, Vite, and Tone.js. It supports computer-keyboard playing, touch/click input, one-key chord shortcuts, MIDI controllers, sampled piano audio, practice mode, and performance recording.

## Quick start

Requirements: Node.js `^20.19.0` or `>=22.12.0`, plus pnpm.

```bash
cd frontend
pnpm install
pnpm dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The browser starts audio after your first interaction.

## Playing

- Click or tap the on-screen piano. Scroll horizontally to explore the visible range.
- Lower computer-key octave: white keys `Z X C V B N M`, black keys `S D G H J`.
- Upper computer-key octave: white keys `Q W E R T Y U I`, black keys `2 3 5 6 7`.
- Hold several mapped keys together to play chords. `Space` holds sustain; the Sustain control latches it.
- `←` / `→` shifts the computer-key mapping by an octave (−3 to +3). `Esc` releases held notes.
- Use **One key, many notes** to assign a keyboard key to a group of pitches. Create separate shortcut banks for different songs or performances; banks are saved in local storage and follow octave shift.
- Use **Sampled piano** for a more realistic sound. It downloads Salamander piano samples from the Tone.js sample host; the Synth option works offline. Adjust **Room Reverb** for a dry sound or a more spacious ambience.

## MIDI controller

1. Connect a USB or Bluetooth MIDI keyboard.
2. Open KeyFlow from `localhost` or an HTTPS website.
3. Select **Connect MIDI keyboard** and grant permission.
4. Play the controller. MIDI note velocity and a connected sustain pedal are supported when the controller sends those messages.

Web MIDI is browser-dependent. Recent desktop Chrome and Edge are recommended; unsupported browsers can still use the computer keyboard and on-screen keys.

## Live Mode and recording

- **Live Mode** hides setup and practice distractions and requests full-screen mode where available. Press Escape or use **Exit Live Mode** to return.
- **Performance recorder** records note-on/note-off timing from the computer keyboard, on-screen piano, and MIDI input. Replay it or export a JSON event file.
- Recordings remain in page memory until exported; they are not uploaded to a server.

## Guided practice and MIDI import

- Choose **Music practice** to practice the included right-hand melody or left-hand chord exercise.
- Import a `.mid` / `.midi` file (max 2 MB) in practice mode. Select a track or all tracks, then adjust octave and tempo.
- MIDI parsing happens locally in the browser. MP3/WAV transcription is not implemented.
- The included Interstellar-inspired exercise uses the note pattern supplied by the user; it is not an official soundtrack transcription.

## Project structure

```text
frontend/
├── src/
│   ├── audio/                 # Audio engine and instrument implementations
│   ├── features/
│   │   ├── midi/              # Web MIDI connection and device UI
│   │   ├── performance/       # Recording, playback, and export
│   │   ├── piano/             # Main instrument, controls, and keyboard input
│   │   ├── practice/          # Guided lessons and MIDI song practice
│   │   └── shortcuts/         # User-defined chord shortcuts
│   ├── shared/
│   │   ├── types/             # Shared TypeScript types
│   │   └── utils/             # Music theory, keyboard mapping, MIDI parsing, tests
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── e2e/                       # Browser-level manual/e2e helpers
├── vite.config.ts
├── tsconfig.json
└── package.json
```

The `@/` import alias points to `src/`. Prefer feature-local components and hooks; place cross-feature utilities in `shared/` and audio-engine concerns in `audio/`.

## Quality checks and formatting

```bash
cd frontend
pnpm format        # Apply Prettier formatting
pnpm format:check  # Check formatting in CI or before review
pnpm typecheck     # Strict TypeScript check
pnpm test          # Run unit tests
pnpm build         # Typecheck and produce production files in dist/
```

Prettier settings live in `.prettierrc.json`. Keep imports grouped, use meaningful names, keep UI components focused, and avoid adding business logic directly to large JSX blocks.

## Deploy as a website

Build the static site with `pnpm build`. Deploy the contents of `frontend/dist/` to a static host such as Cloudflare Pages, Netlify, or Vercel. Set the build command to `pnpm build` and output directory to `dist` (with the project root set to `frontend`). Web MIDI requires HTTPS in production. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for detailed steps.

## Contributing

Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. Changes should include focused tests where practical and pass formatting, typecheck, tests, and build checks.
