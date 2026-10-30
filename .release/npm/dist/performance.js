import { appendFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
/** Optional diagnostic events; no I/O when FEATHERS_PROFILE_TRACE is unset. */
export function traceStartup(phase, details) {
    const destination = process.env.FEATHERS_PROFILE_TRACE;
    if (!destination)
        return;
    try {
        appendFileSync(destination, `${JSON.stringify({ phase, atMs: performance.now(), epochMs: Date.now(), pid: process.pid, ...details })}\n`, 'utf8');
    }
    catch { /* Observability must never break a service startup. */ }
}
//# sourceMappingURL=performance.js.map