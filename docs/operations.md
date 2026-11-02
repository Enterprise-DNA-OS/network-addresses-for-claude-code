# Operate and recover

Use a dedicated database and trusted operator role. The tables enable row-level security and revoke access from public, but the owner role bypasses those restrictions. There is no application sign-in or per-team permission model. Restrict database credentials and generated reports at the operating-system and network layers. A namespace separates address plans; it is not a tenant security boundary.

PGlite runs one process at a time. Close it before opening another command. PostgreSQL supports concurrent readers; this CLI serializes inventory writers so imports and approvals cannot allocate the same host concurrently. Errors roll back the transaction. --dry-run also rolls back audit and import metadata. No network operation occurs.

Back up PGlite's complete data directory while the process is closed. Test recovery into a separate directory and compare record counts and representative decisions. For PostgreSQL, use your database provider's backup and restore process, with a tested recovery copy. `export` writes a portable JSON snapshot; there is no automatic restore command for that snapshot. It fails if the destination already exists.

Keep .env files, .data, exports, imports, drafts, views and docs-out out of git. Reports and exports are created with private file permissions where the operating system supports them. Files still need appropriate Windows access controls. The report header can load a configured logo and a public font. Keep logo paths local for offline work.

Actor names come from the command line. Audit history captures before and after values but a database administrator can alter it. Use authenticated access and external audit retention for a shared production deployment. Releasing an address retires the record; it never disconnects a device or frees a DHCP lease. Reuse an address only after separately verifying the network change.
