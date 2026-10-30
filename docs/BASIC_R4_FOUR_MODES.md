# Basic r4 — four modes, FeathersJS v5

Baseline: 0.2.6 + Vitesse Basic r3. Correct `notes.ts` channel join typing with the Feathers `RealTimeConnection` type, without using `any` or disabling strict TypeScript.

Configuration: `FEATHERS_ADAPTER=koa|express` and `FEATHERS_SOCKETIO=0|1` are dev-server process environment settings. Default `koa + socketio` preserves the previous behavior. The Vite define constants only expose these public mode labels to the frontend; credentials are not exposed.

Test plan: root `npm run check:release`, root `npm run check:security`, Basic `pnpm run typecheck`, Basic `pnpm run test:feathers:modes-contract` and manual browser `/feathers` in all four modes. When Socket.IO is enabled, create/patch/remove a note and verify event propagation in two tabs.

No npm dependency changes. Avoid reinstalling 1300+ Vitesse dependencies. The 0.2.6 network transport test coverage is retained; the four-mode browser matrix is still to be certified on Windows.
