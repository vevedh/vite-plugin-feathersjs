# Basic r8 — Instrumented startup profiling

The baseline is Basic r7 (4/4 E2E PASS). No normal Vitesse features are removed.

## Usage (PowerShell)

From `examples/basic`:

```powershell
.\scripts\PROFILE_R8.ps1 -Runs 3
```

Runs alternate Full and Transport profiles by repetition (Full/Transport, Transport/Full, Full/Transport). Every profile checks four modes, REST CRUD and two-client Socket.IO events. A single report is produced at `docs-private/basic-r8-alternated-profile.json`, alongside per-run files.

## Startup events

`FEATHERS_PROFILE_TRACE` activates append-only JSONL events, limited to the child Vite process. The report records milliseconds from spawn for: `vite.config.resolved`, `vite.configureServer.enter`, `vite.postMiddleware.enter`, Feathers discovery, runtime creation, module loading, transport startup, `socketio.listen` and the HTTP readiness probe.

Events are diagnostic, not proof of CPU-time attribution: differences reflect elapsed wall clock, cache, network and Windows scheduling. A profile can record negative event offsets close to spawn due to approximate wall-clock alignment; prioritize *differences between phases* over absolute event timestamps.

The trace is off unless the benchmark explicitly enables it. Unknown event file errors never prevent application startup. Per-run child trace files are removed in all exit paths.

## Scope and limitations

PWA/DevTools are disabled only in the Transport diagnostic profile. They remain enabled by default. Do not interpret the two profile medians as causal in isolation; cold/warm cache conditions matter. No production dependencies were modified and HMR reconnect stability is not certified in this iteration.
