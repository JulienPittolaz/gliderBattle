# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Analytics (GA4)

Analytics is initialized from environment variables in `src/analytics/ga.ts`.

- `VITE_GA_MEASUREMENT_ID`: GA4 measurement ID (for example `G-XXXXXXXXXX`).
- `VITE_ANALYTICS_ENABLED`: optional override (`true` or `false`).
- `VITE_ANALYTICS_DEBUG`: optional GA debug mode (`true` or `false`).

Default behavior:

- Analytics is enabled when `VITE_GA_MEASUREMENT_ID` is set.
- It is auto-disabled on localhost (`localhost`, `127.0.0.1`, `[::1]`) unless explicitly enabled with `VITE_ANALYTICS_ENABLED=true`.
- `VITE_ANALYTICS_ENABLED=false` always disables analytics.

Example `.env.production` or `.env.staging`:

```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_DEBUG=false
```

## Multiplayer Endpoint

The multiplayer client resolves the Colyseus endpoint in this order:

1. `VITE_COLYSEUS_URL` (if set)
2. Same-origin WebSocket URL based on the current page origin
   - `https://...` page => `wss://...`
   - `http://...` page => `ws://...`

This avoids production fallbacks to localhost when no env var is provided.
In production builds, localhost endpoints in `VITE_COLYSEUS_URL` are ignored and same-origin is used instead.

Example local split setup (Vite frontend + Colyseus backend on port `2567`):

```env
VITE_COLYSEUS_URL=ws://localhost:2567
```

## Server Environment Mode

The Node server uses `APP_ENV` to decide whether it is running in development or production mode.

Precedence:

1. `APP_ENV`
2. `NODE_ENV`
3. fallback to development

Accepted values for `APP_ENV`:

- `production` or `prod`
- `development`, `dev`, or `local`

Examples:

```env
APP_ENV=development
```

```env
APP_ENV=production
```

Notes:

- Development mode enables the local startup fallback catalog when TrustMRR is unavailable.
- Production mode disables that fallback and expects real TrustMRR data or a valid persisted cache.
