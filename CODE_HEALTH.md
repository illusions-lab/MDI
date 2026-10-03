# Code-health backlog

This backlog records issues observed while hardening the internal mdast
provenance transport. They are deliberately out of scope for that change, but
the evidence and completion conditions below make each item independently
actionable.

## P1 — MDI version declarations are compared as strings

**Evidence.** `mdi-core/src/lib.rs::diagnostics` decides whether a declared
frontmatter `mdi` version is newer with `declared > MDI_SPEC_VERSION`. This is
lexicographic ordering, so versions such as `10.0` and `2.10` do not follow
numeric major/minor ordering. Existing tests cover only `3.0` versus `2.0`.

**Repair direction.** Parse the MDI declaration into a deliberately small,
documented numeric version type (including a policy for malformed values) and
compare numeric components. Keep package SemVer and MDI language-version
semantics separate.

**Acceptance criteria.** Table-driven tests cover equal, older, newer, multi-
digit major/minor, missing components, whitespace, and malformed declarations;
only genuinely newer supported-shape declarations emit
`mdi.version.unsupported`, with the existing frontmatter byte span.

## P1 — PDF rendering permits remote-resource SSRF and has no hard timeout

**Evidence.** `mdi-core/src/lib.rs::render_html_node` copies an image node's URL
into `<img src="...">`. `nodejs/packages/to-pdf/src/index.ts::renderHtmlToPdf`
passes that HTML to Playwright `page.setContent` without request interception,
URL allow-listing, or an offline context. The same function launches Chromium,
renders, and closes it without an operation deadline or forced process cleanup.
An attacker-controlled document can therefore make the browser request loopback
or private-network URLs, and a stalled launch/navigation/PDF/close can occupy a
worker indefinitely.

**Repair direction.** Make PDF rendering offline by default. Intercept all
requests and allow only explicitly supported embedded schemes/resources; if
remote resources are an opt-in feature, resolve and validate every redirect
against a public-network policy. Wrap the complete Chromium lifecycle in a
deadline and ensure timeout/error paths terminate the browser process.

**Acceptance criteria.** Integration tests prove HTTP(S), loopback, link-local,
private-network, `file:`, and redirect-based fetches are blocked by default;
approved embedded assets still render; a deliberately hung adapter rejects
within the configured deadline and leaves no Chromium child process behind.

## P1 — Python and Android JNI lockfiles reject `--locked` builds

**Evidence.** `mdi-core/Cargo.toml` is version `2.0.6`, while both
`python/Cargo.lock` and `mdi-android-jni/Cargo.lock` still record `mdi-core`
version `2.0.5`. Running `cargo check --locked` from either `python/` or
`mdi-android-jni/` fails with “cannot update the lock file … because --locked
was passed”. Android's `android/scripts/build-native.sh` does not pass
`--locked`, so ordinary CI can silently rewrite dependency resolution.

**Repair direction.** Regenerate and commit both leaf lockfiles whenever the
path dependency changes, and make native build/test/release entry points use
`--locked`. Add a cheap CI lockfile validation step for every Rust manifest.

**Acceptance criteria.** `cargo check --locked --manifest-path
python/Cargo.toml` and `cargo check --locked --manifest-path
mdi-android-jni/Cargo.toml` pass in a clean checkout; Android native builds also
invoke Cargo with `--locked`; CI fails on either stale lockfile.

## P1 — JavaScript reinterprets frontmatter and publication defaults

**Evidence.** `nodejs/packages/mdi/src/index.ts::toPublicationMdast` receives
Rust's parsed `Frontmatter`, but calls the local `publicationFrontmatter(raw)`.
That helper reparses YAML with `parseYaml`, then independently defaults `mdi` to
`2.0`, `lang` to `ja`, `writingMode` to `horizontal`, and derives
`pageProgression`. `nodejs/packages/mdast-util-mdi/src/source.ts` separately
maps the camelCase publication object back to YAML keys. These host-side rules
can drift from Rust parsing and default semantics.

**Repair direction.** Define the normalized publication metadata/defaults once
in Rust's versioned transport (or a single generated contract) and make JS a
shape-only adapter. Preserve raw YAML for round trips without using it as a
second semantic parser.

**Acceptance criteria.** Cross-runtime fixtures for absent, explicit, invalid,
and future frontmatter values produce identical normalized metadata; deleting
the JS YAML parser/default logic does not change adapter output; round-tripping
still preserves the Rust-owned raw frontmatter.

## P1 — Diagnostics and PDF/export helpers parse the same source twice

**Evidence.** `nodejs/packages/mdi/src/index.ts::renderWithDiagnostics` and
`renderWithDiagnosticsAsync` call `parse(source)` and then invoke a renderer
closure. The public `renderHtmlWithDiagnostics`, `renderEpubWithDiagnostics`,
`renderDocxWithDiagnostics`, `renderTextWithDiagnostics`, and
`renderTextFormatWithDiagnostics` closures call Rust APIs that parse the same
source again. The PDF path builds on rendered HTML and retains the separately
parsed result, so large-document editor/export workflows pay duplicate parser
cost and can only assume the two passes stay semantically identical.

**Repair direction.** Add an internal Rust parse-once operation/handle or
combined result that derives diagnostics, headings, and requested output from
one document. Keep lifetime/ownership explicit at each FFI boundary.

**Acceptance criteria.** An instrumented parser counter is exactly one for
every `*WithDiagnostics` and PDF preparation operation; returned diagnostics,
headings, spans, and output all derive from the same parse; behavior and error
mapping remain compatible.

## P2 — Performance CI reports results but cannot catch regressions

**Evidence.** `.github/workflows/ci.yml` runs four ignored release benchmarks,
uploads JSONL, and makes `large-document-performance-report` a dependency of
publication checks. `scripts/write-large-document-performance-report.mjs`
validates only that the four input sizes exist, then states that throughput is
“reported rather than hard-gated”. No ratio, baseline, complexity, or maximum
duration can fail the workflow.

**Repair direction.** Gate deterministic structural work counters and scaling
ratios, while retaining wall-clock measurements as reports or using a generous
runner-normalized threshold. Store an explicit reviewed baseline with bounded
update procedure.

**Acceptance criteria.** A synthetic super-linear implementation makes CI
fail; expected variance on hosted runners does not; the report identifies the
baseline, observed ratio, allowed threshold, and failing case.

## P2 — `mdi-core/src/lib.rs` is monolithic and retains two parser tracks

**Evidence.** `mdi-core/src/lib.rs` is roughly 5,900 lines and contains public
wire types, the complete parser/lowering path, renderers, FFI, Wasm bindings,
and most tests. It also retains the deprecated compatibility model
`MdiSyntaxDocument`/`MdiBlock` and `parse_mdi_syntax`, whose line-oriented parser
is separate from the canonical `parse_document`/markdown-rs path. The root
module therefore mixes unrelated ownership boundaries and exposes two syntax
decision paths.

**Repair direction.** Split document IR, parsing/lowering, diagnostics,
serialization, renderers, and host boundaries into focused modules. Replace
the deprecated parser implementation with an adapter over the canonical tree,
then remove it after the documented compatibility window.

**Acceptance criteria.** All syntax decisions flow through one canonical
parser; compatibility output is projection-only; module/API tests prevent host
bindings from reaching parser internals; public compatibility and serialized
fixtures remain stable through the migration.

## P2 — JNI exception, panic, and allocation-failure paths lack coverage

**Evidence.** `mdi-android-jni/src/lib.rs` exports JNI functions directly as
`extern "system"`. It maps JNI string/allocation errors to Java exceptions and
null pointers, but does not put `catch_unwind` at the JNI boundary. Its two unit
tests call `mdi_core` helpers directly and never exercise `JNIEnv`, exception
classes, null inputs, allocation failures, or panic containment. Android's
Jacoco configuration explicitly excludes `MdiNative`/`NativeMdiBridge`, so the
90% Kotlin line gate cannot detect this gap.

**Repair direction.** Centralize every JNI entry through a panic-safe boundary
and a tested error mapper. Add JVM/emulator tests for invalid/null strings,
Rust errors, pending exceptions, and returned null/byte arrays; use a controlled
test hook or abstraction for otherwise impractical allocation failures.

**Acceptance criteria.** No Rust panic can unwind across JNI; every failure
produces the documented Java exception with no leaked local/native resources;
tests execute each exception/null branch, and CI reports native-boundary
coverage separately from the Kotlin Jacoco gate.
