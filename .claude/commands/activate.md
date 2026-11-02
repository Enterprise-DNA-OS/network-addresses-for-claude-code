# Record a verified address activation

Read the address and its reservation decision first. The operator must supply the evidence that the actual deployment has been verified separately.

```bash
npm run network -- activate "<address name or id>" --reference="<deployment evidence>" --note="<what was verified>" --actor="<operator>" --dry-run
```

Review the preview, then save without --dry-run within the operator's authority. This records an active address in the database. It never connects to or configures a device. Do not invent a deployment or use a proposal as proof that it happened.
