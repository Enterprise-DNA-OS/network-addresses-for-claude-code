# Move address records from Infrahub

Checked 2 November 2026 against the vendor's [object export instructions](https://docs.infrahub.app/objects/manage-from-cli), [CLI reference](https://docs.infrahub.app/infrahubctl/infrahubctl-object) and [IPAM schema](https://docs.infrahub.app/schema-library/reference/ipam).

## Export from your account

Use authorised access. Find the actual kinds with `infrahubctl schema list`. The Marketplace schema uses IpamPrefix and IpamIPAddress. Other schemas use IpamIPPrefix. Inspect the kind before exporting.

```bash
infrahubctl object get IpamPrefix --output csv --all-columns > prefixes.csv
infrahubctl object get IpamIPAddress --output csv --all-columns > addresses.csv
```

Use a list query, without a record identifier. A detail query produces field/value pairs and cannot be imported here. The CLI supports --limit and --offset. Check your exported counts against the source and collect all pages if you use those options. Export the intended branch. This project does not fetch from Infrahub or handle its credentials.

The vendor's [CSV formatter](https://github.com/opsmill/infrahub-sdk-python/blob/stable/infrahub_sdk/ctl/formatters/csv.py) uses attribute and relationship names as headers. Relationship values are display labels. List exports need not contain ids. The natural key here is namespace plus prefix, or namespace plus host address.

## One command per export

```bash
npm run network -- import infrahub --kind=prefixes --file=prefixes.csv --source=infrahub-main-2026-11 --actor="Your name" --dry-run
npm run network -- import infrahub --kind=addresses --file=addresses.csv --source=infrahub-main-2026-11 --actor="Your name" --dry-run
```

Reconcile the preview, then repeat each without --dry-run. Use a new empty database for real records, not the demo. Run migrate first. Prefixes should arrive before addresses.

## Mapping

| Vendor column | Owned record |
|---|---|
| ip_namespace | Namespace name, mandatory unless a verified single-network file uses --namespace |
| prefix | Validated canonical IPv4/IPv6 range |
| member_type | address or prefix, mandatory |
| is_pool | True or False, mandatory |
| address | IPv4/IPv6 host with mask |
| status | active, reserved or deprecated, mandatory |
| description | Description and fallback record name |
| fqdn | Address name when present |
| role | Preserved role text |
| scope, interface and every extra column | Original export evidence, not recreated relationships |

Namespace labels must uniquely identify their source objects. If labels are duplicated, stop and map them explicitly. An absent namespace is never silently assigned to default. Operators and next-review dates start empty because a source export is not proof of local accountability. Use review with an evidence reference to set them.

Unknown status choices and missing mandatory fields fail. Adapt custom kinds deliberately before import. Source CSV formula-escape prefixes remain as exported. Original columns and a batch file digest remain in the database. Do not put secrets in exports.

## Reconcile before switching

Compare counts per namespace, both address families, active and reserved addresses, all container ranges and a sample of raw columns. Run compliance, review-due, capacity and change-review. Resolve the ownership and hierarchy findings. Draft a handover and verify one reservation with the network owner.

The importer does not overwrite changed duplicates, delete records missing from a newer export, or restore a whole Infrahub deployment. Keep original backups, permissions, branches, relationships, artifacts and automation code separately. Keep network discovery, DNS, DHCP and deployment tools in place until any replacement is built and tested. Enterprise DNA maps these parts as custom work.
