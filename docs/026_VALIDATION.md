# Windows certification — 0.2.6-r1

Baseline: 0.2.5, 22/22 tests, npm audit 0/0, typecheck/build/pack PASS.

1. Preserve a copy of your already-secured package-lock.json.
2. Extract this archive into C:\devs (it does not include node_modules or package-lock.json).
3. Run `npm install`, then `npm run check:release`, `npm run check:security`.
4. Optionally benchmark `npm run check:quick` against `npm run check:fast`.
5. For persistent HMR verify a service exporting hotUpdate with a real Socket.IO client, update that file, confirm connection ID stays the same and service behavior changes.
6. For modules without hotUpdate verify disconnect/reconnect and no duplicate callbacks.

Caveat: in-place HMR is explicitly opt-in and should not modify application-wide hooks, channels or auth state.
