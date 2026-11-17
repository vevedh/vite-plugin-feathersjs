/** Gate 25: opt-in single-listener production laboratory. Never mutate the legacy profile. */
import { readFile } from 'node:fs/promises'

function exactly(source, before, after, label) {
  if (typeof source !== 'string' || source.split(before).length !== 2) {
    throw new Error(`GATE25_SINGLE_SOURCE_DRIFT: ${label}`)
  }
  return source.replace(before, after)
}

function singleServer(files) {
  const source = files.get('api/server.mjs')
  if (typeof source !== 'string' || !source.includes("prefix: '/api', cors: false") ||
      !source.includes('await checkTenantSchema(persistence.provider)') ||
      !source.includes('if (realtime) await runtime.start(httpServer)')) {
    throw new Error('GATE25_SINGLE_INCOMPATIBLE_SERVER')
  }
  let entry = source
  entry = exactly(entry,
    "import { configureJwtLab, protectNotesWithJwt } from './runtime/auth-setup.mjs'\n",
    "import { createSpaHandler } from './runtime/spa-static.single.mjs'\nimport { configureJwtLab, protectNotesWithJwt } from './runtime/auth-setup.mjs'\n",
    'auth import')
  entry = exactly(entry,
    "const adapter = process.env.FEATHERS_ADAPTER === 'express' ? 'express' : 'koa'",
    "const adapter = process.env.FEATHERS_ADAPTER === 'express' ? 'express' : 'koa'\nif (adapter !== 'express') throw new Error('SINGLE_SERVER_REQUIRES_EXPRESS')",
    'adapter guard')
  entry = exactly(entry,
    'const persistence = await openNotesDatabase()\n',
    "const serveSpa = await createSpaHandler(new URL('../dist/', import.meta.url))\nconst persistence = await openNotesDatabase()\n",
    'SPA initialization')
  entry = exactly(entry,
    "  if (pathname !== '/api' && !pathname.startsWith('/api/')) {\n    res.writeHead(404, { 'content-type': 'application/json' }); res.end('{\"error\":\"Not found\"}'); return\n  }",
    "  if (pathname !== '/api' && !pathname.startsWith('/api/')) {\n    void serveSpa(req, res).catch(() => { if (!res.headersSent) { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('Internal error') } else res.destroy() })\n    return\n  }",
    'SPA route')
  entry = exactly(entry,
    '  runtime.handler(req, res, error => {',
    "  // REST always negotiates JSON errors, regardless of the SPA Accept header.\n  req.headers.accept = 'application/json'\n  runtime.handler(req, res, error => {",
    'API JSON errors')
  return entry
}

function dockerfile() {
  return `# syntax=docker/dockerfile:1.7
# The existing Node/Nginx production profile remains untouched.
FROM node:24-bookworm-slim AS production-dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-bookworm-slim AS assets
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN corepack pnpm run build

FROM node:24-bookworm-slim AS node-runtime
WORKDIR /app
COPY --chown=node:node --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node api ./api
COPY --chown=node:node --from=assets /app/dist ./dist
USER node
EXPOSE 3030
CMD ["node", "api/server.single.mjs"]

FROM dhi.io/bun:1 AS bun-runtime
WORKDIR /app
COPY --chown=65532:65532 --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=65532:65532 package.json ./package.json
COPY --chown=65532:65532 api ./api
COPY --chown=65532:65532 --from=assets /app/dist ./dist
USER 65532:65532
EXPOSE 3030
CMD ["bun", "api/server.single.mjs"]
`
}

function compose(runtime) {
  const bun = runtime === 'bun'
  const command = bun ? 'bun' : 'node'
  return `# Gate25 laboratory, opt-in single listener. Append after compose.prod.yaml.
# The original web service is disabled by its legacy profile, never deleted.
services:
  api:
    build:
      context: .
      dockerfile: infra/compose/Dockerfile.single
      target: ${bun ? 'bun-runtime' : 'node-runtime'}
    command: ["${command}", "api/server.single.mjs"]
${bun ? '    user: "65532:65532"\n' : ''}    environment:
      FEATHERS_ADAPTER: express
      FEATHERS_PUBLIC_ORIGIN: "http://127.0.0.1:\${P5_SINGLE_PORT:-8081}"
      FEATHERS_PREVIEW_ORIGIN: "http://127.0.0.1:\${P5_SINGLE_PORT:-8081}"
    networks:
      - backend
      - frontend
    ports:
      - "127.0.0.1:\${P5_SINGLE_PORT:-8081}:3030"
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    healthcheck:
      test: ["CMD", "${command}", "-e", "fetch('http://127.0.0.1:3030/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 8
      start_period: 20s
  web:
    profiles: ["legacy"]
`
}

function markdown(runtime) {
  return `# Production Single Server — laboratoire Gate 25

Ce profil est **opt-in** et destiné à une validation locale. Il conserve le serveur historique \`compose.prod.yaml\` (Nginx + Feathers) intact.

**Runtime choisi :** ${runtime === 'bun' ? 'Bun DHI (UID 65532)' : 'Node 24 (utilisateur node)'}.

Le build utilise pnpm 10.30.2 et \`pnpm-lock.yaml\` en mode frozen. L'image finale ne contient pas les dépendances de développement. Aucune conversion implicite vers un nouveau \`bun.lock\` n'est effectuée.

## Démarrage PowerShell 5.1

1. Générer les secrets par les commandes \`db:secret:lab\` et \`auth:secrets:lab\` du projet (ne jamais les afficher ni les versionner).
2. Installer les dépendances et construire avec \`corepack pnpm install --frozen-lockfile\` puis \`corepack pnpm run build\`.
3. Lancer \`docker compose -f compose.prod.yaml -f compose.single.yaml up -d --build\`.
4. Ouvrir http://127.0.0.1:8081 ; adapter uniquement \`P5_SINGLE_PORT\` si nécessaire.

Sur le mode universel MariaDB/MongoDB, conserver l'override fournisseur intermédiaire :

\`docker compose -f compose.prod.yaml -f compose.mariadb.yaml -f compose.single.yaml up -d --build\`

\`docker compose -f compose.prod.yaml -f compose.mongodb.yaml -f compose.single.yaml up -d --build\`

## Contrats de sécurité

- Une seule écoute HTTP porte la SPA, le REST sous \`/api\` et les connexions Socket.IO.
- Ni chemin caché, ni source, ni API ne doivent être renvoyés comme SPA.
- Le réseau \`backend\` reste privé. Seul \`127.0.0.1:8081\` est publié sur l'hôte.
- Le service \`web\` original reste disponible via son profil \`legacy\`, mais ne doit pas être activé avec ce profil.
- Les secrets JWT/DB restent montés depuis le Compose initial ; les volumes des bases ne sont jamais supprimés par ce profil.
- Vérifier indépendamment JWT, 2 tenants, accès croisés, révocation, routes profondes et arrêt/redémarrage avant toute promotion.
- Ce projet n'est pas prêt pour Internet. Ajouter un reverse proxy HTTPS, une stratégie de durcissement réseau et une qualification des images par digest avant production.

## Retour à la baseline

Arrêter l'API du laboratoire, puis redémarrer uniquement le Compose standard, **sans** \`down -v\`. Utiliser un nouveau projet Docker Compose si deux profils doivent fonctionner simultanément.
`
}

export async function enableSingleServer(files, options) {
  if (!['node','bun'].includes(options.singleServer) || options.ui !== 'daisyui' ||
      options.render !== 'spa' || options.adapter !== 'express' || options.transport !== 'both' ||
      options.compose !== 'prod' || options.devApi !== 'vite' || options.pwa !== 'off' ||
      options.auth !== 'jwt' || options.persistence !== 'lab' || options.tenantMode !== 'isolated-lab' ||
      options.databaseMode !== 'universal' || options.db !== 'main:universal' ||
      options.cache !== 'none' || options.storage !== 'none') {
    throw new Error('GATE25_SINGLE_PROFILE_REFUSED: supports only daisyui SPA express both JWT universal isolated-lab compose prod, no PWA')
  }
  for (const path of ['api/server.single.mjs','api/runtime/spa-static.single.mjs','infra/compose/Dockerfile.single','compose.single.yaml','SINGLE_SERVER.md']) {
    if (files.has(path)) throw new Error(`GATE25_SINGLE_CONFLICT: ${path}`)
  }
  const source = await readFile(new URL('./single-server/spa-static.mjs', import.meta.url),'utf8')
  const produced = new Map([
    ['api/server.single.mjs', singleServer(files)],
    ['api/runtime/spa-static.single.mjs', source],
    ['infra/compose/Dockerfile.single', dockerfile()],
    ['compose.single.yaml', compose(options.singleServer)],
    ['SINGLE_SERVER.md', markdown(options.singleServer)],
  ])
  for (const [path, content] of produced) files.set(path, content)
  const baseReadme = files.get('README.md')
  const baseCompose = files.get('COMPOSE.md')
  if (typeof baseReadme !== 'string' || typeof baseCompose !== 'string') throw Error('GATE25_SINGLE_DOCS_DRIFT')
  files.set('README.md',baseReadme + '\nProfil Single Server local : consulter [SINGLE_SERVER.md](SINGLE_SERVER.md).\n')
  files.set('COMPOSE.md',baseCompose + '\n## Profil Single Server opt-in\n\nConsulter [SINGLE_SERVER.md](SINGLE_SERVER.md). Le profil Nginx + API d’origine reste inchangé.\n')
}
