# Watch + Quarantine Runbook

## Purpose

Use watch mode to detect risky skill/plugin/config file changes and quarantine them before activation.

## Configuration

- Command:

```bash
sapperai-proxy watch --policy ./policy.yaml
```

- Optional watch paths:

```bash
sapperai-proxy watch --path ~/.claude/plugins --path ~/.config/claude-code
```

- Relevant env vars:
  - `SAPPERAI_POLICY_PATH`
  - `SAPPERAI_AUDIT_LOG_PATH`
  - `SAPPERAI_QUARANTINE_DIR`
  - `SAPPERAI_THREAT_FEED_CACHE`

## Standard Operating Procedure

1. Start watch mode with explicit policy and audit path.
2. Install/update skill or plugin under monitored directories.
3. Verify audit log entries tagged `install_scan`.
4. If blocked and `mode: enforce`, inspect quarantine records.

```bash
sapperai-proxy quarantine list
```

5. Restore only after manual review:

```bash
sapperai-proxy quarantine restore <id>
```

## Troubleshooting

- **No events detected**
  - Verify watch paths are correct.
  - Confirm file names match config-like filters (`skill.md`, `plugin.json`, `.mcp.json`, etc.).

- **Expected block did not quarantine**
  - Check policy mode (`monitor` will log only).
  - Confirm write permissions for quarantine directory.

- **High CPU while watching**
  - Limit paths with repeated `--path` flags.
  - Exclude broad project roots when possible.

## Common Commands

```bash
# Start watcher
sapperai-proxy watch --policy ./policy.yaml

# List quarantine records
sapperai-proxy quarantine list

# Restore item
sapperai-proxy quarantine restore <id>
```
