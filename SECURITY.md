# Security Policy

## Reporting a vulnerability

**Please report security issues privately first — do not open a public issue.**

If you believe you have found a security issue in dpkit, contact the maintainers through the
private reporting channel (once the repository is created, use GitHub's
**"Report a vulnerability"** flow under the **Security** tab, or email a maintainer directly).
Do not post the details in a public issue, pull request, or discussion.

What to include:

- The affected version(s) and how you are running dpkit (CLI flag set, config, MCP client, …).
- A minimal reproducer (ideally a small datapack file or command that triggers the issue).
- Any output, error, or exit code you observed.

The maintainers will acknowledge the report, keep you updated on progress, and coordinate a fix
and (if warranted) a security advisory. Please give a reasonable window for the fix to land
before disclosing publicly.

## Supported versions

dpkit is a **per-version** checker: it checks any datapack against Minecraft versions from
**1.14** through the latest release/snapshot (1.13 and older are rejected explicitly). Security
fixes are released for the **latest published npm release** (`dpkit-mc`); older releases are
generally not backported. If you need a fix on an older release, mention it in the report.

## Security boundaries and limitations

Please understand what dpkit is — and is not — so reports are scoped correctly:

- dpkit is a **local static checker/linter**. It reads and parses datapack files (mcfunction,
  JSON, NBT, `.zip` archives) and reports diagnostics. It is **not a sandbox** and does **not**
  isolate the data it processes.
- **Do not run dpkit (or its MCP server) on untrusted input or on an untrusted network/endpoint.**
  Treat datapack content as untrusted data: malformed or malicious input is parsed by the engine
  and the built-in parsers, and a parsing bug could in principle be exploitable. In particular,
  avoid pointing `--datapack=` / the MCP server at directories or archives you do not trust.
- The **MCP server** (`dpkit-mcp`) exposes filesystem/checking tools over stdio. Run it only for
  a trusted client and a trusted workspace; do not expose it to untrusted callers.
- dpkit **downloads per-version data** (command trees, registries, block states, vanilla data) from
  upstream endpoints and caches it locally. Run it on networks you trust, and be aware that the
  first online run for a new version performs network fetches.
- dpkit runs with the privileges of the user invoking it and reads whatever paths you point it at.
  It does not elevate privileges or modify the datapack.

Out-of-scope (not vulnerabilities in dpkit): bugs in the upstream Spyglass engine / game data that
dpkit merely reflects, and anything that requires an already-compromised environment.

## What to expect

- **P0** (arbitrary code execution, path traversal, secret exfiltration): fixed ASAP, coordinated
  disclosure, likely a security advisory.
- **P1/P2** (crashes, DoS via pathological input, incorrect-but-not-exploitable behavior): fixed in
  the next release, disclosed in release notes.
- Everything else is treated as a normal bug and tracked publicly.
