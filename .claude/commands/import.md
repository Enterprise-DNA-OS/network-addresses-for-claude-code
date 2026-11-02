# Bring Infrahub address records across

Read CLAUDE.md. Use the operator's records, never invented examples.

```bash
npm run network -- import infrahub --kind=<prefixes|addresses> --file="<CSV path>" --source="<export name>" --actor="<operator name>" --dry-run
```

Read the existing record first. Fill every placeholder from the request and verified evidence. Preview the exact change, then apply without --dry-run when authorised. A preview is not a saved record. Report the saved id.

Read docs/replace-infrahub.md. Use an authorised object-list export. Reconcile namespace labels, counts and original columns. Never import into the demo database or change duplicate source records silently.

Never connect to devices, send messages or describe inventory evidence as a live discovery result.
