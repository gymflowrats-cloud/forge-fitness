# Optional: Gemini proxy on Cloudflare Workers (free)

By default Forge stores your Gemini API key on your phone and calls Google directly. If you'd rather keep the key off the device, deploy this tiny Worker; it holds the key as a secret and forwards only the two endpoints Forge uses (`models` list and `generateContent`).

## Deploy

```bash
cd cloudflare-worker
npx wrangler login
npx wrangler secret put GEMINI_API_KEY      # paste your AI Studio key
npx wrangler secret put APP_TOKEN           # optional: any long random string
npx wrangler deploy
```

Wrangler prints a URL like `https://forge-gemini.<you>.workers.dev`.

Then edit `wrangler.toml` → `ALLOWED_ORIGIN = "https://<you>.github.io"` and run `npx wrangler deploy` again.

## Use it in Forge

Settings → AI coach → **Proxy URL**:

- without APP_TOKEN: `https://forge-gemini.<you>.workers.dev`
- with APP_TOKEN: `https://forge-gemini.<you>.workers.dev/<APP_TOKEN>`

Tap **Test**. Anyone who knows the full URL can use your quota, so set `APP_TOKEN` and keep the URL private. The free Workers tier (100k requests/day) is far more than one person needs.
