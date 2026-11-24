#!/usr/bin/env node
// Publication depuis ce worktree expressément interdite. La release qualifiée
// sera préparée séparément à partir d'un tarball dont la provenance est prouvée.
console.error('VEVEDH_NPM_PUBLISH=BLOCKED | REASON=RELEASE_ARTIFACT_NOT_CERTIFIED')
process.exitCode = 1
