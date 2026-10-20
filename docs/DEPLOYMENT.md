# Deploy KeyFlow Piano

KeyFlow is a static Vite app. The production build is written to `frontend/dist/`.

## Build locally

```bash
cd frontend
pnpm install
pnpm build
```

Preview the production bundle with `pnpm exec vite preview` before publishing.

## Cloudflare Pages

1. Import the repository into Cloudflare Pages.
2. Set the root directory to `frontend`.
3. Set the build command to `pnpm build`.
4. Set the build output directory to `dist`.
5. Use a Node version compatible with Vite 8 (`^20.19.0` or `>=22.12.0`).

## Netlify or Vercel

Set the project root to `frontend`, the build command to `pnpm build`, and the publish/output directory to `dist`. Ensure the platform uses a compatible Node version.

## Important notes

- Web MIDI requires a secure context: HTTPS in production or `localhost` during development.
- The Synth instrument works without downloading audio samples. Sampled piano mode fetches audio files from `https://tonejs.github.io/audio/salamander/`, so the visitor needs an internet connection and the sample host must be reachable.
- Recordings and chord shortcuts are local to the user's browser. The current app does not include user accounts, cloud sync, or a backend.
- If deploying under a subpath rather than a domain root, configure Vite's `base` option and test asset paths before publishing.
