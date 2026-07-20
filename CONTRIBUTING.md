# Contributing to MDI

Thanks for helping improve illusion Markdown (MDI). Contributions to the specification, Rust core, language bindings, renderers, documentation, tests, and examples are all welcome.

## Before you start

- Read the [syntax specification](./SYNTAX.md) and [architecture](./ARCHITECTURE.md) for changes that affect parsing, the document IR, or rendering.
- Search existing issues and pull requests before opening a new one.
- For a substantial feature, syntax proposal, or behavior change, open an issue first so we can agree on the design and compatibility impact.
- Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Development setup

MDI is a multi-language repository. Rust is the executable authority for MDI syntax and document semantics; bindings must not independently interpret or reimplement MDI syntax.

### Rust core

```sh
cd mdi-core
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

### Node.js and documentation

Use Node.js 22+ and the pinned pnpm version (`pnpm@9.15.0`). Building the WASM packages also needs Rust's `wasm32-unknown-unknown` target and [wasm-pack](https://rustwasm.github.io/wasm-pack/).

```sh
cd nodejs
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

The PDF package tests use Chromium. Install it when working on that package:

```sh
pnpm --filter @illusions-lab/mdi-to-pdf exec playwright install chromium
```

### Android

Android work requires JDK 17+, the Android SDK/NDK, Rust Android targets, and `cargo-ndk`. See [android/README.md](./android/README.md) for setup and test commands.

## Making a change

1. Fork the repository and create a focused branch from `main`.
2. Keep changes small and avoid unrelated formatting or generated-file churn.
3. Add or update tests whenever behavior changes. Parser, IR, and renderer changes should include representative MDI fixtures or regression tests.
4. Update the specification and user-facing documentation when public syntax, output, or APIs change.
5. Run the checks relevant to the directories you touched before opening a PR.

For JavaScript packages, add a Changeset when the change warrants a published package release. Do not add one for internal-only work, documentation-only changes, or test-only changes.

## Pull request expectations

Use the pull request template and explain both the user-visible effect and the validation you ran. Keep commits understandable; maintainers may squash them on merge. A pull request should be reviewable independently and must not include secrets, credentials, or unrelated changes.

By submitting a contribution, you agree that it may be distributed under this repository's [MIT License](./LICENSE).

## Reporting issues and vulnerabilities

Use the issue forms for reproducible bugs, feature proposals, and documentation corrections. Do not file security vulnerabilities in public issues; follow [SECURITY.md](./SECURITY.md) instead.
