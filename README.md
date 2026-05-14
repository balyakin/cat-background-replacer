# KotoFon

KotoFon is a React PWA for replacing backgrounds in cat photos. It keeps the original cat pixels, builds a
foreground mask in the browser, generates or creates a clean background plate, and composites the final image locally.

The app is designed for pet adoption portraits, shelter posts, and quick social media images where the cat should stay
real and only the surrounding scene should change.

## Features

- Upload JPEG, PNG, WebP, and HEIC photos.
- Use camera capture on supported devices.
- Crop photos to common aspect ratios or keep the original frame.
- Create an AI foreground mask in the browser with manual brush and eraser fixes.
- Choose background presets such as sofa, studio, windowsill, armchair, blanket, greenery, or random.
- Generate AI background plates through OpenRouter with primary and fallback models.
- Use the local studio background without an external generation request.
- Composite the final image locally, compare before and after, share, download, and save history in the browser.
- Add an optional sticker before export.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- vite-plugin-pwa
- OpenRouter image generation through a small Node.js proxy
- Browser segmentation with `@imgly/background-removal` and `onnxruntime-web`
- Local browser history with `idb-keyval`

## Requirements

- Node.js 18 or newer.
- An OpenRouter API key for AI generated backgrounds.

The original photo is processed in the browser for crop, mask, and composition. OpenRouter receives only the generated
background prompt and placement metadata, not the source photo.

## Install

```bash
npm install
```

## Frontend Development

```bash
npm run dev
```

This starts the Vite development server for UI work. Full background generation requires the Node.js proxy from
`server.mjs` or an equivalent reverse proxy for `/api/openrouter/*`.

## End-to-End Local Run

```bash
npm run build
OPENROUTER_API_KEY=sk-or-v1-your-token PORT=5174 node server.mjs
```

Then open:

```text
http://127.0.0.1:5174
```

`OPENROUTER_API_KEY` provides a shared server-side key. Users can also enter their own OpenRouter key in the app
settings; the browser sends it to the local proxy through `X-OpenRouter-Key`.

## Build

```bash
npm run build
```

The production build is written to `dist/`.

## Configuration

Runtime settings are stored in `public/app-config.json`:

- `openRouter.primaryBackgroundModel` sets the default image model.
- `openRouter.fallbackBackgroundModel` and `openRouter.secondaryFallbackBackgroundModel` set fallback models.
- `openRouter.imageSize` controls generated image size for models that support it.
- `openRouter.timeoutMs` controls request timeout.
- `camera.enabled` toggles camera capture.
- `imageProcessing.maxSourceSidePx` and `imageProcessing.jpegQuality` control local image preparation.

Deployment examples are available in `deploy/`:

- `kotofon.env.example`
- `kotofon.service`
- `nginx-kotofon.conf`

## Scripts

```bash
npm run dev            # Start Vite for frontend development
npm run build          # Type-check and build production assets
npm run preview        # Preview the Vite production build
npm run generate-icons # Generate app icons
```

Use `node server.mjs` for the production proxy flow because `npm run preview` does not provide the OpenRouter API proxy.

## Project Structure

```text
public/        Runtime config and app icons
src/           React app, image processing, masks, storage, and UI components
deploy/        Example systemd, env, and nginx files
scripts/       Utility scripts
server.mjs     Static file server and OpenRouter proxy
```

## License

MIT
