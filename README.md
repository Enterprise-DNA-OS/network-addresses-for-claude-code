# Network Addresses for Claude Code

Find the last free address, the range nobody owns and the reservation still waiting for a decision. Keep address plans and the evidence behind them in a database you own.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT. Install and run the demo. | Your address rules, imports, reports and connections. | Installed and operated through Omni by Enterprise DNA. One setup fee, then a retainer. |

[Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=infrahub) · [Instead of Infrahub](https://enterprisedna.co/omni/instead-of/infrahub)

## Start with the weekly address review

Requires Node 20 or later.

```bash
npm install
npm run demo
npm run network -- weekly-review
npm run docs
npm run view
```

Open the folder in Claude Code, Codex, OpenCode or Cursor. AGENTS.md routes every runtime to the same instructions and commands. PGlite keeps the local database in .data/db. DATABASE_URL selects PostgreSQL. DATA_DIR chooses another local database. Never seed a working database.

The fictional demo has an office printer range with one address left, an isolated warehouse reusing the same private range, a missing scanner subnet, overdue ownership reviews and an overdue change decision. Dates are relative to the first seed. Seeding again does not reset existing records.

## The weekly rituals

/capacity shows headroom for each range. /reservations reviews held addresses. /review-due checks accountability. /change-review lists outstanding decisions. /weekly-review brings these together with follow-up work. /draft-handover produces a private handover for the next operator.

30 CLI commands and 31 operating slash commands, plus /customise and /new-view. Run `npm run network -- help` for the full list. Every command supports --json. Every database mutation requires --actor and supports --dry-run. Record selection accepts an exact name, a partial UUID or a case-insensitive name fragment. An ambiguous request lists candidates and exits 1.

## Plan a reservation

```bash
npm run network -- next-free "Office printers"
npm run network -- propose --prefix="Office printers" --address=10.20.1.6 --name="Receiving printer" --owner="Morgan Lee" --review-due=2027-06-01 --reason="Receiving desk" --due=2027-06-01 --actor="Alex Chen" --dry-run
```

Choose dates appropriate to the work. Remove --dry-run to record the proposal. Use `decide <change id> --decision=approved --note="Checked against current inventory" --actor="Morgan Lee"` to reserve the address in the database. A different named reviewer is required. Approval rechecks ownership, review dates, subnet boundaries and competing reservations. Names supplied by an operator are not authenticated identities.

`activate <address id> --reference="<deployment evidence>" --note="<verification>" --actor="<operator>"` records a reserved address as active after a separate deployment verification.

Nothing connects to a router, changes DNS, leases an address or sends a message. A database reservation is a planning record. Check actual network state and follow your deployment process separately. `release <address id> --reason="..." --actor="..."` retires the record without deleting its history.

## What the calculations mean

Namespaces isolate address space. The same address can exist in different namespaces, but two live allocations of one host cannot exist inside one namespace, even with different masks. Addresses attach to their most specific containing range.

Address ranges count active and reserved addresses. IPv4 network and broadcast addresses are excluded unless a range is marked as a pool or is /31 or /32. IPv6 counts the whole range. A /31 assumes a point-to-point link. Container ranges count the space of their nearest live child ranges, avoiding double counting nested children. Native creation refuses child ranges inside an address range. Imported hierarchy errors are kept and reported for reconciliation.

Capacity is exact database arithmetic, including IPv6. Available space describes recorded inventory, not discovered free addresses on a live network. Percentages round to two decimal places. Proposed changes do not consume capacity until approved, and two proposals can compete for the same address. The second approval fails once the first has reserved it.

## Ten questions you can answer today

These are demonstrated questions for this system, not claims that Infrahub cannot answer them.

1. Which ranges have less than a fifth of their addresses left? Run capacity.
2. Which held addresses need a new owner review? Run reservations and review-due.
3. Which records are missing a containing range? Run compliance.
4. Which identical addresses belong to separate networks? Run addresses.
5. What is the next recorded free address in the printer range? Run next-free.
6. Which decision is overdue, and who requested it? Run change-review.
7. What evidence supported a reservation when it was approved? Run change.
8. Which follow-up belongs to the warehouse operator? Run actions.
9. Who changed ownership, and what did the record say before? Run activity.
10. How much address space is assigned to child ranges without counting nested ranges twice? Run capacity.

## Bring your history

```bash
npm run network -- import infrahub --kind=prefixes --file=fixtures/infrahub-prefixes.csv --source=demo-export --actor="Your name" --dry-run
npm run network -- import infrahub --kind=addresses --file=fixtures/infrahub-addresses.csv --source=demo-export --actor="Your name" --dry-run
```

The fixtures are fictional and follow the vendor's documented object-list CSV format. Replace them with authorised exports, check the preview, then repeat without --dry-run. Prefixes and addresses each import in one command. Original columns remain attached. Identical repeat imports are skipped. Changed duplicates fail for explicit reconciliation, and an invalid row rolls back the whole file. Imported owners and review dates start unverified. [Switching guide](docs/replace-infrahub.md).

This imports the base IPAM attributes, not arbitrary Infrahub models, automation code, device credentials, branch history or permissions. The namespace column holds a display label. Confirm that labels uniquely identify your networks before import. Keep the original backup.

## Documents and read-only views

Edit brand.json to put your business name, colours and logo on output. `npm run docs` writes a network handover for each namespace and a change record for each proposal. `npm run view` writes weekly capacity, review evidence and reservation snapshots. /draft-handover and /draft-change write private HTML to drafts/. Nothing sends.

/compliance flags missing ownership, overdue reviews, invalid address placement and overdue follow-ups. [Rules and sources](docs/compliance.md) distinguish technical address rules from local review policies. The checks support a review, not a certification.

## Your first hour: ten things to ask for

1. Put our business name on the handover.
2. Show the last free printer address.
3. Explain why the warehouse can reuse the office range.
4. Show the unassigned scanner subnet.
5. Preview our prefix export.
6. Record our evidence and review dates.
7. Propose an address and have another operator review it.
8. Draft the next network handover.
9. Add a report grouped by our site code.
10. Add a support-team field with a tested migration.

/customise writes a migration and tests the change. /new-view adds a read-only report. No second command library is needed.

## Verification and operations

`npm test` creates a temporary database, migrates and seeds twice, exercises all 30 commands, and checks exact capacity, IPv6, /31 and /32 boundaries, namespace isolation, stale review blocks, competing approvals, dry-run rollback, malformed imports, preserved source columns, evidence, audit, export and escaped HTML. CI supports Windows and Linux on Node 20 and 22, plus PostgreSQL 17. Local results do not imply that remote CI ran.

Use TEST_DATABASE_URL only with an empty disposable database to test PostgreSQL. Tests refuse an existing public schema with application tables. The application uses a trusted operator database role. It does not implement multi-user sign-in, tenant isolation or an unalterable audit trail. Do not expose the database directly to users. See [operations](docs/operations.md) and [why no front end](docs/why-no-front-end.md).

## Infrahub and your version

Infrahub Enterprise starts at $40,000 per year on the [vendor's pricing page](https://opsmill.com/pricing/), checked 2 November 2026. The page does not label the currency. This is a vendor list price, not a customer invoice. Infrahub Community is already free under Apache 2.0 and includes its core data platform. Enterprise adds scale, security and support. This smaller MIT project focuses on address planning and operator evidence. It does not replace the entire Infrahub platform. [Selection evidence](docs/research.md).

Enterprise DNA maps your records, builds your rules and connections, and operates your version through Omni by Enterprise DNA. One setup fee, then a retainer. [Book 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=infrahub).

MIT. Not affiliated with OpsMill, Infrahub or Anthropic. Hosting and agent usage have their own costs.
