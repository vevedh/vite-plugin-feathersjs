# Basic r10 Windows supplied measurements (one run per report)

| Report | Loader | 4/4 PASS | Average HTTP-ready (s) |
|---|---|---|---:|
| basic-r10-bundle-a0903cece7894a55bfe9d4d82d7dc85b.json | bundle | True | 30.24 |
| basic-r10-runner-6a8ccd7cbeb848aeabd43135caa2fe47.json | runner | True | 51.63 |
| basic-r10-bundle-51cbd55061e94ab8bc44aea7f5c42f6f.json | bundle | True | 49.72 |
| basic-r10-runner-59fd7f4fbba849e49ed89e20381c50ea.json | runner | True | 56.46 |

Bundle is retained as the default. Measurements vary markedly; the benchmark is not evidence of a universal speed advantage.

## Design
See `examples/basic/README-FEATHERS-PINIA.md` for the client/store lifecycle and Windows verification.
