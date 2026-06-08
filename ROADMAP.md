# SapperAI Roadmap

SapperAI is early-stage open source infrastructure for MCP and tool-calling agent security. This roadmap is intentionally practical: improve detector coverage, keep the maintainer workflow reliable, and make the public CLI/MCP path easier to verify.

## Near term

- Expand malicious and benign regression fixtures for prompt injection, command injection, path traversal, data exfiltration, and code injection.
- Harden the MCP proxy path around tool listing, tool calls, policy overrides, and audit reasons.
- Keep `scan`, `harden`, and quarantine flows reproducible for local projects and CI.
- Improve documentation for policy configuration, runbooks, and safe reporting.
- Keep release-time smoke tests deterministic.

## Mid term

- Add focused rule packs for common agent and MCP server patterns.
- Improve false-positive handling for educational, documentation, and test-fixture content.
- Publish clearer examples for SDK, MCP proxy, and CLI usage.
- Add release notes that map detector changes to concrete threat scenarios.

## Non-goals

- SapperAI is not a replacement for sandboxing, least-privilege credentials, code review, or runtime isolation.
- SapperAI does not guarantee that every prompt injection or tool abuse attempt will be blocked.
- The project should not claim broad production adoption before public evidence supports it.
