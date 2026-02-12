# Adversary Campaign Runbook

## Purpose

Stress-test sandboxed agent behavior with adversarial prompts, then produce reproducible findings and blocklist proposals.

## Configuration

Required flags:

```bash
sapperai-proxy adversary run --policy ./policy.yaml --out ./artifacts/adversary
```

Optional controls:
- `--agent <agent-config.json>`
- `--max-cases <n>`
- `--max-duration-ms <ms>`
- `--seed <seed-string>`

## Standard Operating Procedure

1. Run campaign in controlled environment:

```bash
sapperai-proxy adversary run \
  --policy ./policy.yaml \
  --out ./artifacts/adversary \
  --max-cases 50 \
  --max-duration-ms 300000
```

2. Review generated artifacts:
  - `summary.json`
  - `trace.jsonl`
  - `proposals.json`
  - `finding-*.repro.json`

3. Replay specific finding:

```bash
sapperai-proxy adversary replay --policy ./policy.yaml --repro ./artifacts/adversary/<run>/finding-1.repro.json
```

4. Promote only validated proposals into policy blocklist.

## Troubleshooting

- **No findings generated**
  - Increase `--max-cases` and campaign duration.
  - Ensure policy is not over-permissive in monitor-only pipelines.

- **Replay differs from run**
  - Use same policy file version.
  - Ensure repro artifact path is correct and not modified.

- **Slow campaigns**
  - Reduce case count or disable non-essential detectors in test policy.

## Common Commands

```bash
# Run deterministic campaign
sapperai-proxy adversary run --policy ./policy.yaml --out ./artifacts/adversary --seed smoke

# Replay finding
sapperai-proxy adversary replay --policy ./policy.yaml --repro ./artifacts/adversary/<run>/finding-1.repro.json
```
