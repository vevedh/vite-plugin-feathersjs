/** Opt-in, loopback-only Docker Compose profiles for Vite-first SPA applications.
 * Authentication and database capability guards from scaffold.mjs stay active.
 */
const composeModes = new Set(['dev', 'prod', 'both'])

function requireExact(files, path, before, after) {
  const source = files.get(path)
  if (typeof source !== 'string' || source.split(before).length !== 2) {
    throw new Error(`Unexpected ${path} template; refusing Docker generation`)
  }
  files.set(path, source.replace(before, after))
}

function composeReadme(options) {
  const dev = options.compose === 'dev' || options.compose === 'both'
  const prod = options.compose === 'prod' || options.compose === 'both'
  return `# Docker Compose — ${options.name}

Ces fichiers déploient le squelette Vite-first, **pas une application déjà sécurisée pour Internet**.
Le service de démonstration \`notes\` est en mémoire et sans authentification. Les ports HTTP sont publiés sur \`127.0.0.1\` uniquement.
Aucun port de base de données n'est exposé. Le générateur **n'active pas** les profils JWT, OAuth ou bases externes : leurs garde-fous existants continuent de refuser le démarrage tant que leur intégration n'est pas certifiée.

## Prérequis

- Docker Desktop avec Docker Compose v2.
- Node.js compatible et Corepack/pnpm pour produire \`pnpm-lock.yaml\`.
- Vérifier les dépendances, leurs licences et vulnérabilités avant tout déploiement.

${dev ? `## Développement

\`docker compose -f compose.dev.yaml up --build\`

Ouvrir http://127.0.0.1:5173. Le serveur Vite monte Feathers via le plugin Vite, sans lancer un deuxième processus d'API. Aucun autre port n'est publié.

Arrêt : \`docker compose -f compose.dev.yaml down\` (le volume de dépendances est conservé).

` : ''}${prod ? `## Image de déploiement (prototype isolé)

Créer et réviser le lockfile à la racine du projet :

\`corepack pnpm install --lockfile-only\`

\`docker compose -f compose.prod.yaml up --build -d\`

Ouvrir http://127.0.0.1:8080. Nginx sert la SPA et relaie \`/api/\` à Feathers et ${options.transport === 'both' ? '\`/socket.io/\` au serveur temps réel.' : 'aucun Socket.IO (REST uniquement).'} Le backend n'a pas de port publié sur l'hôte.

Arrêt : \`docker compose -f compose.prod.yaml down\`.

**Avant une réelle mise en production :** remplacer le service notes non protégé, activer JWT/RBAC et une persistance durable, vérifier les migrations, isoler les secrets, mettre en place le reverse proxy HTTPS et la politique d'origines, vérifier les journaux et sauvegardes et exécuter les E2E REST/Socket.IO de la cible. Ne pas changer l'interface hôte de \`127.0.0.1\` vers \`0.0.0.0\` sans ces contrôles.

` : ''}## Particularités

- Choix générés : ${options.ui} SPA, ${options.adapter}, ${options.transport}, PWA ${options.pwa}.
- Le serveur API autonome peut écouter sur toutes les interfaces **du conteneur** uniquement via \`FEATHERS_BIND_HOST=0.0.0.0\` ; le réseau \`backend\` est interne et non publié.
- Le mode PWA, lorsqu'il est sélectionné, ne doit jamais mettre \`/api/\` ou \`/socket.io/\` en cache.
- Les images de production sont construites depuis un lockfile audité ; ne jamais copier de \`.env\` réel dans les images.
- Les ports peuvent être personnalisés uniquement côté loopback via \`P4_DEV_PORT\` et \`P4_HTTP_PORT\`.
`
}

function devCompose(options) {
  return `name: ${options.name}-dev
services:
  app:
    image: node:24-bookworm-slim
    working_dir: /workspace
    command: ["sh", "-c", "corepack pnpm install --no-frozen-lockfile && corepack pnpm exec vite --host 0.0.0.0 --port 5173 --strictPort"]
    environment:
      NODE_ENV: development
      VITE_FEATHERS_REALTIME: "${options.transport === 'both' ? '1' : '0'}"
      P4_DEV_PORT: "\${P4_DEV_PORT:-5173}"
    volumes:
      - .:/workspace
      - dependencies:/workspace/node_modules
    ports:
      - "127.0.0.1:\${P4_DEV_PORT:-5173}:5173"
    security_opt:
      - no-new-privileges:true
volumes:
  dependencies:
`
}

function prodCompose(options) {
  return `name: ${options.name}-prod
services:
  api:
    build:
      context: .
      dockerfile: infra/compose/Dockerfile.api
    environment:
      NODE_ENV: production
      FEATHERS_BIND_HOST: "0.0.0.0"
      FEATHERS_ADAPTER: "${options.adapter}"
      FEATHERS_SOCKETIO: "${options.transport === 'both' ? '1' : '0'}"
      FEATHERS_API_PORT: "3030"
      FEATHERS_PUBLIC_ORIGIN: "http://127.0.0.1:\${P4_HTTP_PORT:-8080}"
      FEATHERS_PREVIEW_ORIGIN: "http://127.0.0.1:\${P4_HTTP_PORT:-8080}"
    expose:
      - "3030"
    networks:
      - backend
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3030/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 8
      start_period: 20s
  web:
    build:
      context: .
      dockerfile: infra/compose/Dockerfile.web
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "127.0.0.1:\${P4_HTTP_PORT:-8080}:8080"
    networks:
      - frontend
      - backend
    security_opt:
      - no-new-privileges:true
networks:
  frontend:
  backend:
    internal: true
`
}

const apiDockerfile = `FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack pnpm install --frozen-lockfile --prod
COPY api ./api
USER node
EXPOSE 3030
CMD ["node", "api/server.mjs"]
`

const webDockerfile = `FROM node:24-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack pnpm install --frozen-lockfile
COPY . .
RUN corepack pnpm run build

FROM nginx:stable-alpine
COPY infra/compose/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
`

function nginx(options) {
  return `server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  autoindex off;
  server_tokens off;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy no-referrer always;
  add_header X-Frame-Options DENY always;
  location = /api { return 404; }
  location /api/ {
    proxy_pass http://api:3030/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 30s;
  }
${options.transport === 'both' ? `  location /socket.io/ {
    proxy_pass http://api:3030;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 65s;
  }
` : `  location /socket.io/ { return 404; }
`}  location / {
    try_files $uri $uri/ /index.html;
  }
}
`
}

const dockerIgnore = `node_modules
.git
.agents
.ai
.codex
.cursor
.claude
.gemini
.windsurf
.mcp.json
.env
.env.*
!.env.example
database.env
*.zip
*.log
coverage
dist
.vite
.quasar
docs-private
test-results
playwright-report
`

export function enableCompose(files, options) {
  if (!composeModes.has(options.compose) || options.render !== 'spa') {
    throw new Error('Compose generation supports only SPA and compose dev|prod|both')
  }
  const dev = options.compose === 'dev' || options.compose === 'both'
  const prod = options.compose === 'prod' || options.compose === 'both'
  if (dev && options.devApi !== 'vite') {
    throw new Error('Compose development requires --dev-api vite for a single Feathers/Vite listener')
  }
  const created = new Map([['COMPOSE.md', composeReadme(options)]])
  if (dev) created.set('compose.dev.yaml', devCompose(options))
  if (prod) {
    created.set('compose.prod.yaml', prodCompose(options))
    created.set('infra/compose/Dockerfile.api', apiDockerfile)
    created.set('infra/compose/Dockerfile.web', webDockerfile)
    created.set('infra/compose/nginx.conf', nginx(options))
    // The only Docker interface bound to all container addresses is the private API listener.
    requireExact(files, 'api/server.mjs', "const realtime = process.env.FEATHERS_SOCKETIO === '1'", "const bindHost = process.env.FEATHERS_BIND_HOST === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1'\nconst realtime = process.env.FEATHERS_SOCKETIO === '1'")
    requireExact(files, 'api/server.mjs', "const wsPort = Number(process.env.FEATHERS_SOCKET_PORT || 3031)\n", '')
    requireExact(files, 'api/server.mjs', ' || !Number.isInteger(wsPort) || wsPort === port', '')
    requireExact(files, 'api/server.mjs', "socketio: realtime ? { port: wsPort, origins: [...new Set([origin, previewOrigin])], host: '127.0.0.1' } : false,", "socketio: realtime ? { mode: 'external', origins: [...new Set([origin, previewOrigin])] } : false,")
    requireExact(files, 'api/server.mjs', 'await runtime.start()\nconst httpServer = createServer', 'const httpServer = createServer')
    requireExact(files, 'api/server.mjs', "httpServer.listen(port, '127.0.0.1', resolve)", 'httpServer.listen(port, bindHost, resolve)')
    requireExact(files, 'api/server.mjs', '  httpServer.listen(port, bindHost, resolve)\n})', '  httpServer.listen(port, bindHost, resolve)\n})\nif (realtime) await runtime.start(httpServer)\nelse await runtime.start()')
    requireExact(files, 'api/server.mjs', '  await new Promise(resolve => httpServer.close(resolve))\n  await runtime.close()', '  await runtime.close()\n  if (httpServer.listening) await new Promise(resolve => httpServer.close(resolve))')
  }
  created.set('.dockerignore', dockerIgnore)
  for (const [key, content] of created) {
    if (files.has(key)) throw new Error(`Compose file conflicts with a template: ${key}`)
    files.set(key, content)
  }
}
