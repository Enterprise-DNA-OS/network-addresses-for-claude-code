# Network Addresses for Claude Code

For the network operator who owns address plans and review evidence. Set your business name in brand.json.

## Work from records

Read before writing. Use npm run network -- help. Every answer starts with a current CLI read. A namespace is an address-space boundary, not a security tenant. No command discovers devices or configures a network.

## Routing

| Request | Recipe |
|---|---|
| Review network boundaries | /namespaces |
| Read the address ranges | /prefixes |
| Read the address register | /addresses |
| Read one network and its follow-ups | /namespace |
| Read one range and its addresses | /prefix |
| Read one address and its evidence | /address |
| Read a proposal and its decision snapshot | /change |
| Review address capacity | /capacity |
| Find the next recorded free address | /next-free |
| Review held addresses | /reservations |
| Find ownership and evidence gaps | /review-due |
| Review outstanding address decisions | /change-review |
| Read follow-up work | /actions |
| Read before and after history | /activity |
| Check address and accountability rules | /compliance |
| Prepare the weekly network review | /weekly-review |
| Add an isolated address plan | /add-namespace |
| Add a range or container | /add-prefix |
| Propose an address reservation | /propose |
| Record a separately verified activation | /activate |
| Record a reviewed reservation decision | /decide |
| Retire an address record | /release |
| Log ownership and review evidence | /review |
| Add follow-up work | /add-action |
| Record completed follow-up work | /close-action |
| Bring Infrahub address records across | /import |
| Write a private portable snapshot | /export |
| Draft a network handover | /draft-handover |
| Draft an address decision record | /draft-change |
| Find urgent work | /attention |
| Log verification | /log |
| Change fields or a rule | /customise |
| Add a read-only report | /new-view |

## Rules

Every mutation uses --actor and starts with --dry-run. Apply the reviewed result within the operator's authority. Do not invent identities, dates, inspection evidence or decisions. Ambiguous names list candidates and stop. Approval needs a different named reviewer and records an inventory reservation only. Confirm actual network state through the operator's established process.

Drafts remain in drafts/. Never send or publish. Never delete records, deploy device configuration, modify DNS or DHCP, or handle device credentials. Use release for an authorised retirement. Read docs/compliance.md before interpreting checks. A finding is not a certification.

## Files

scripts/network.mjs is the one CLI. supabase/migrations holds tested schema changes. npm test uses a disposable database. npm run docs and npm run view render branded HTML. AGENTS.md routes Codex, OpenCode and Cursor to this same library. Do not fork commands per runtime.

Enterprise DNA builds and operates custom versions through Omni by Enterprise DNA. https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=infrahub
