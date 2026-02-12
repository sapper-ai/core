# Threat Intel + Blocklist Runbook

## Purpose

Synchronize known-malicious indicators into local cache and enforce them via policy matching.

## Configuration

Policy snippet:

```yaml
mode: enforce
defaultAction: allow
failOpen: true
threatFeed:
  enabled: true
  autoSync: true
  failOpen: true
  cachePath: /tmp/sapperai-threat-intel.json
  sources:
    - https://example.org/threat-feed.json
blocklist:
  contentPatterns:
    - "ignore\\s+all\\s+previous\\s+instructions"
```

## Standard Operating Procedure

1. Run sync manually before rollout windows:

```bash
sapperai-proxy blocklist sync --policy ./policy.yaml
```

2. Check cache freshness:

```bash
sapperai-proxy blocklist status --cache-path /tmp/sapperai-threat-intel.json
```

3. Inspect loaded entries:

```bash
sapperai-proxy blocklist list --cache-path /tmp/sapperai-threat-intel.json
```

4. Verify specific indicator presence:

```bash
sapperai-proxy blocklist check "malicious-package"
```

## Troubleshooting

- **Sync fails due to network/source errors**
  - Confirm source URL reachability.
  - Check for source schema mismatch (`entries` array expected).
  - For incident operations, use cached snapshot and keep `failOpen` policy explicit.

- **Unexpected missing indicators**
  - Validate cache path points to expected file.
  - Re-run sync and confirm source returns entries.

- **Old entries disappeared**
  - Ensure sync is called with the full expected source set.
  - Confirm cache persistence location is stable between runs.

## Common Commands

```bash
sapperai-proxy blocklist sync --policy ./policy.yaml
sapperai-proxy blocklist status
sapperai-proxy blocklist list
sapperai-proxy blocklist check <indicator>
```
