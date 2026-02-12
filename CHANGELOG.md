# Changelog

All notable changes to this repository are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Threat-intel based allow/block enforcement for MCP/runtime scanning.
- File watch + quarantine operations for local skill/plugin/config paths.
- Blocklist sync/status/list/check command surface.
- Adversary campaign run/replay tooling with artifact outputs.
- Operational docs and security smoke CI gate.

### Changed

- Refactored detector creation and threat-intel policy merge logic to shared core helpers.
- Hardened CLI option parsing for missing/invalid values.
- Improved threat feed reliability with timeout and cache-preserving sync behavior.

### Fixed

- Replay flow no longer triggers unintended threat-feed sync side effects.
