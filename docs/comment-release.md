# MDI 2.1 comment release and recovery

MDI 2.1 recognizes editorial comments in every document, including declared 2.0
and unversioned source. Valid comments previously displayed as HTML text are now
omitted from every publication format. Existing version declarations are retained.
Default tree APIs return IR 1.0 without comments. Explicit `includeComments` returns
IR 1.1; source serialization retains comments. Body projections always exclude
comments. Unterminated openers remain literal with `mdi.comment.unterminated` and
can appear in publications. See [the comment contract](src/content/docs/syntax/comments.md).

## Candidate preparation

Keep the Rust, Python, JNI and Android package versions on the 2.1 series. The npm
release policy reads `config/release-series.json`; the initial available 2.1 release
is 2.1.0, while subsequent releases advance the patch. The Release workflow accepts
an explicit `target_version` and rejects versions already occupied before any
manifest is changed. Dependency closure includes peer and optional consumers.

Run local language, adapter, editor, publication and performance gates before
requesting the complete CI gate. Record the MDI and Milkdown candidate commits,
package versions, integration results and artifact checksums. Local packing and
installation are allowed; production publication runs only in GitHub Actions.
Never require a local registry login.

## Immutable npm artifacts

The Release workflow builds and packs the entire selected dependency closure,
then uploads `npm-release-<source SHA>` before publishing anything. Its
`manifest.json` records the source commit, package versions, archive filenames and
SHA-512 integrity values. Publication and GitHub release assets use those saved
bytes. Existing registry versions are accepted only when their integrity matches.

For a failed publication, rerun the existing workflow attempt. It restores the
original artifact automatically. To recover from another run, dispatch Release
with `release_sha` set to the original gated main commit and `resume_run_id` set
to the original run ID. Leave `target_version` empty or use the saved version.
Registry verification waits up to ten minutes for accepted packages to become visible.
Recovery uses the current workflow commit for orchestration while the saved manifest
and checkout still pin the original candidate and archive bytes. Publishing-tool
repairs do not force new package versions. Missing or expired recovery artifacts fail closed. Never rebuild or overwrite an
already published version; fix incorrect artifacts with a new patch release.

Rust, Python, Android and Swift retain their existing CI publication workflows.
Swift uses its prepare/publish binary artifact process. Publish and verify MDI
before releasing Milkdown on its independent minor version. Then update illusions
to the actual registry versions, including its lockfile and overrides. Do not
release the illusions application as part of this change.

## Registry verification

Install every published language and JavaScript artifact from its actual registry.
Verify default and inclusive IR, exact comment values and byte spans, source
round trips and publication omission. Preserve registry versions, source commits,
CI URLs, artifact integrity values and verification results in the release record.
Partial language publication is an incomplete release; recover each remaining
artifact without replacing successful publications.

Recovery can select a workflow ref containing corrected publication tooling.
`publish-versioned-packages.mjs`, `create-github-releases.mjs`, and their shared
`release-artifacts.mjs` helper are read from that ref; checkout HEAD, the gated source SHA, package versions, checksums, and
uploaded tarballs remain those of the original candidate. Registry visibility
is polled after npm acknowledges publication; transient absence never causes
an immediate repeat upload, and conflicting bytes still fail closed.
