# Contributing to SapperAI

Thanks for helping improve SapperAI. The project focuses on guardrails for MCP servers, tool-calling agents, and developer workflows where model output can trigger real tools.

## Local setup

```bash
pnpm install
pnpm build
pnpm test
```

Useful checks before opening a PR:

```bash
pnpm exec tsc -b --noEmit
pnpm --filter @sapper-ai/core run test:smoke
```

## What makes a good contribution

Security-sensitive changes should explain the threat model. A strong PR usually includes:

- the attack or misuse pattern being addressed;
- one or more malicious examples that should be blocked;
- benign examples that should continue to pass;
- expected decision reasons;
- any policy or threshold changes;
- notes about MCP proxy, quarantine, or release impact.

Detector changes belong in the core policy and detector path, not as ad-hoc checks in the MCP layer. Preserve explicit audit reasons so users can understand why a call was allowed or blocked.

## Pull requests

Use the repository PR template. Keep changes small when possible, especially for detector and policy behavior. If you touch security-sensitive behavior, include tests or clearly explain the test gap.

Do not place secrets, tokens, private MCP config, customer data, or live exploit targets in issues, tests, or pull requests.
