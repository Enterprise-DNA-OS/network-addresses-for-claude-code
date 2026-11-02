# Retire an address record

Read CLAUDE.md. Use the operator's records, never invented examples.

```bash
npm run network -- release "<name or id>" --reason="<verified reason>" --actor="<operator name>" --dry-run
```

Read the existing record first. Fill every placeholder from the request and verified evidence. Preview the exact change, then apply without --dry-run when authorised. A preview is not a saved record. Report the saved id.

Verify the actual device or lease was removed through the separate network process before reusing its address.

Never connect to devices, send messages or describe inventory evidence as a live discovery result.
