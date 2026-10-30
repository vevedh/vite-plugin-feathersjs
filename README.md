# Vite Plugin Feathersjs

## Requirements

1. Your Feathers app needs to be created, setup and returned in a function called main

## Example usage:

```ts
// vite.config.ts
// https://vitejs.dev/config/
import { defineConfig } from 'vite'
import { feathers } from 'vite-plugin-feathersjs'

// https://vitejs.dev/config/#async-config
export default defineConfig(async () => {
  return {
    plugins: [feathers({ app: 'src/app.ts', port: 3030 })]
  }
})
```

## Important notes

- Your feathers server will run on another port... make sure to configure socket.io with cors

  - ie: `socketio({ cors: { origin: '*' } })`
- To make things easier, an Environment Variable named VITE_FV_URL is defined in development.

  - In client apps `const url = import.meta.env.VITE_FV_URL`
- This plugin will not run with the build command.

## Security and Publishing

- Do not commit `.npmrc` or tokens. `.gitignore` already excludes `.npmrc`. Use the provided template `./.npmrc.example:1` and an environment variable.
- Local auth:
  - PowerShell: `$env:NPM_TOKEN = "<your-token>"`
  - Bash: `export NPM_TOKEN="<your-token>"`
  - `.npmrc` content (do not commit): `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`
- GitHub Actions (publish on tag):
  ```yaml
  name: Publish to npm
  on:
    push:
      tags: ['v*']
  jobs:
    publish:
      runs-on: ubuntu-latest
      permissions:
        contents: read
        id-token: write  # for npm provenance (optional)
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            registry-url: https://registry.npmjs.org
        - run: npm ci
        - run: npm publish --provenance --access public
          env:
            NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  ```
- After any secret exposure, rotate the token in npm, then ensure the repository’s Security → Secret scanning → Alerts are resolved.
