# Release Template

Copy this template into the GitHub Release description when publishing a new release.

---

## VoteChain Contracts vX.Y.Z

**Release date:** YYYY-MM-DD  
**Contracts audited:** Yes / Pending  
**Breaking changes:** Yes / No

### Highlights

<!-- 2–4 sentences summarising the most important changes in this release -->

### Changelog

<!-- Paste the versioned changelog section from CHANGELOG.md here -->

### WASM Artifacts

| Contract | File | SHA-256 |
|----------|------|---------|
| Governance | `votechain_governance.wasm` | `<hash>` |
| Token | `votechain_token.wasm` | `<hash>` |

Artifacts are attached to this release. Verify checksums before deployment:

```bash
sha256sum votechain_governance.wasm
sha256sum votechain_token.wasm
```

### Upgrade Notes

<!-- Any migration steps, breaking changes, or config updates required -->
See [docs/upgrading.md](docs/upgrading.md) for upgrade instructions.

### Contributors

<!-- GitHub usernames of contributors to this release -->

### Full Changelog

https://github.com/Vera3289/votechain-contracts/compare/vX.Y.(Z-1)...vX.Y.Z
