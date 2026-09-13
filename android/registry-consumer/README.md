# Published Android verification

This standalone consumer resolves an exact version from GitHub Packages, never the local project. Dispatch the Android workflow with `registry_version` to run its comment contract against the downloaded AAR and native library in a hidden emulator. The CI token needs only package read access; no local publishing credentials are required. Test results and downloaded artifact SHA-256 checksums are saved together.
