# Security Policy

SapperAI is a security-sensitive project. The scanner, guard APIs, detector rules, MCP proxy, quarantine flow, and release scripts can affect whether a tool call is allowed or blocked.

## Supported scope

Security reports should focus on repositories and packages maintained by the SapperAI project:

- `sapper-ai`
- `@sapper-ai/core`
- `@sapper-ai/mcp`
- `@sapper-ai/types`
- the public repository at `https://github.com/sapper-ai/core`

SapperAI is a guardrail layer, not a complete sandbox, IAM system, or guarantee that every attack will be blocked. Use it with normal defense-in-depth controls.

## Reporting a vulnerability

If you find a vulnerability, please open a GitHub security advisory when available, or contact the maintainer privately through the repository owner profile.

Do not include secrets, tokens, customer data, private MCP configuration, or exploitable payloads against third-party systems in a public issue. If a report needs a proof of concept, keep it minimal and sanitized.

Useful report details:

- affected package and version
- reproduction steps
- expected allow/block decision
- actual allow/block decision
- sanitized malicious input
- sanitized benign input, if the issue is a false positive
- operating system and Node.js version

## Maintainer process

For security-sensitive changes, maintainers should:

1. add or update malicious and benign regression tests;
2. preserve explicit decision reasons;
3. run the standard verification commands;
4. review whether the change affects MCP proxy, quarantine, or release behavior;
5. document any residual limitation instead of implying a security guarantee.

Standard verification:

```bash
pnpm test
pnpm build
pnpm exec tsc -b --noEmit
pnpm --filter @sapper-ai/core run test:smoke
```
