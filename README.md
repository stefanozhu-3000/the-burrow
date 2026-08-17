# The Burrow — scroll story

A scroll-driven Three.js landing page built from the supplied Burrow model and countryside artwork.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:5173/`.

## Production build

```bash
npm run build
npm run preview
```

The source model is preserved at the project root. The web-ready copy in `public/burrow.glb` uses Meshopt geometry compression and 2K WebP textures.
