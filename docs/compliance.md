# Record checks and their sources

These checks support operator review. They do not certify compliance, enforce a regulator's entire framework or inspect a live network. Checked 2 November 2026.

| Rule | What the command checks | Basis |
|---|---|---|
| CM-8 | Missing owner or missing/overdue next-review date on namespaces and live ranges/addresses | NIST SP 800-53 Rev. 5 CM-8 describes maintaining component inventory and review at an organisation-defined frequency. The chosen dates and owner requirement are local implementation policies. |
| IP-BOUNDARY | A live address has no containing range, sits in a container, sits in a retired range, or occupies an excluded IPv4 boundary | IPv4 subnet boundaries and RFC 3021's two-host /31 point-to-point rule. The local pool flag permits all addresses. |
| LOCAL-HIERARCHY | An address range contains a more specific live range | Local policy: explicit containers hold child ranges; address ranges are leaves. |
| LOCAL-ACTION | An open follow-up is past its due date | Local policy, no statutory deadline asserted. |

Sources:

- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final), CM-8 and CM-8(4). Voluntary framework unless your organisation has adopted it through a contract or applicable requirement.
- [RFC 3021](https://www.rfc-editor.org/rfc/rfc3021), section 2.1: both /31 endpoints can be hosts on point-to-point links.
- [Infrahub IPAM conventions](https://docs.infrahub.app/ipam/overview): separate namespaces, address and prefix capacity, pool semantics and IPv6 accounting inform import compatibility.

Native reservation proposals and approvals require a named owner and current range and namespace review dates. Approvals recheck address availability inside a locked transaction. A second named operator must decide a proposal. These are local controls, not an authenticated separation-of-duties service. No fixed legal retention period is encoded. Choose retention and access rules for your organisation before using personal or sensitive infrastructure data.
