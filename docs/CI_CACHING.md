# CI Caching Strategy

This document describes the caching optimizations implemented in our CI/CD pipeline to improve build performance.

## Overview

The CI pipeline implements multi-level caching for Rust/Cargo builds to reduce build times and minimize unnecessary recompilation.

## Caching Strategy

### Cargo Registry and Git Sources Cache

- **Path**: `~/.cargo/registry` and `~/.cargo/git`
- **Purpose**: Cache downloaded dependencies to avoid network requests for every build
- **Key**: `${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}`
- **Invalidation**: Cache is invalidated when `Cargo.lock` changes

### Build Artifacts Cache

- **Path**: `target/`
- **Purpose**: Cache compiled build artifacts to speed up incremental builds
- **Key**: Includes job-specific suffix (`test`, `wasm`)
- **Invalidation**: Cache is invalidated when dependencies change

### Restore Keys

Each job defines restore keys to provide fallback caching behavior:

```yaml
restore-keys: |
  ${{ runner.os }}-cargo-{job-type}-
  ${{ runner.os }}-cargo-
```

This ensures:
1. If exact cache key matches, use it
2. Otherwise, try the job-type prefix (partial match)
3. Finally, try the generic Cargo cache as last resort

## Jobs and Caching

### Test Job (`cargo test`)
- Uses versioned key: `cargo-test-` for test-specific artifacts
- Caches registry, git sources, and target directory
- Falls back to general Cargo cache if test cache is unavailable

### Build WASM Job (`stellar contract build`)
- Uses versioned key: `cargo-wasm-` for WASM-specific artifacts
- Inherits from test cache if test cache is available
- Maintains separate build artifacts for WASM compilation

## Performance Impact

Expected improvements:
- **First run**: ~5-10 minutes (initial build)
- **Subsequent runs**: ~1-2 minutes (with cache hits)
- **Dependency update**: ~3-5 minutes (cache invalidation)

## Cache Maintenance

- GitHub Actions automatically manages cache expiration (7 days of inactivity)
- Cache is scoped to branches: main, develop, and PR branches
- Total cache size per repository: 5 GB

## Future Optimizations

1. **Split compilation cache**: Separate contracts and tests
2. **sccache integration**: Distributed caching for faster builds
3. **Parallel job caching**: Optimize test and WASM jobs for cache reuse

## Troubleshooting

### Cache not being used
- Check `Cargo.lock` hasn't changed unexpectedly
- Verify GitHub Actions cache storage isn't full
- Review workflow logs for cache hit/miss information

### Slow builds despite caching
- Profile build times with `cargo build -v`
- Consider incremental compilation with `cargo-incremental`
- Review dependency graph for unnecessary dependencies

## References

- [GitHub Actions Caching Documentation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Cargo Build Cache Documentation](https://doc.rust-lang.org/cargo/guide/build-cache.html)
- [Stellar CLI Documentation](https://developers.stellar.org/tools/cli)
