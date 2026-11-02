# Record a reviewed reservation decision

Read CLAUDE.md. Use the operator's records, never invented examples.

```bash
npm run network -- decide "<code or id>" --decision=<approved|rejected> --note="<evidence and decision>" --actor="<operator name>" --dry-run
```

Read the existing record first. Fill every placeholder from the request and verified evidence. Preview the exact change, then apply without --dry-run when authorised. A preview is not a saved record. Report the saved id.

The reviewer must differ from the requester. Approval reserves an inventory address only. It does not approve a router deployment. Recheck live network state separately.

Never connect to devices, send messages or describe inventory evidence as a live discovery result.
