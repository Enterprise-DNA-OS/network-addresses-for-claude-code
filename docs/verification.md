# Verification, 2 November 2026

[GitHub Actions run 41381176141](https://github.com/Enterprise-DNA-OS/network-addresses-for-claude-code/actions/runs/41381176141) passed all five jobs on core build commit 4d568d2:

- Windows, Node 20 and 22: npm test and npm run demo.
- Linux, Node 20 and 22: npm test and npm run demo.
- PostgreSQL 17 on Linux, Node 22: npm test against an empty disposable database.

The final shared report-renderer adjustment keeps long address values and counts together in a cell. After that adjustment, npm test passed again locally on Linux/PGlite and the weekly HTML report was regenerated and visually checked. The adjustment is also in the Command Centre's shared rebuild template.

The suite covers all 30 CLI commands. Fixtures are synthetic. It does not prove production throughput, customer export compatibility outside the documented base schema, authenticated permissions or live network discovery.
