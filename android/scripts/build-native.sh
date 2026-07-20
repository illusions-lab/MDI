#!/usr/bin/env bash
set -euo pipefail

# Requires rustup targets and cargo-ndk. Output is copied into the AAR inputs.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output_dir="$repo_root/android/mdi-android/src/main/jniLibs"

rustup_cargo=""
if command -v rustup >/dev/null 2>&1 \
    && rustup target list --installed | grep -qx 'aarch64-linux-android'; then
    rustup_cargo="$(rustup which cargo)"
fi
cargo_bin="${rustup_cargo:-cargo}"

# A Homebrew Rust installation can precede rustup on PATH. Keep cargo and
# rustc from one toolchain, otherwise Android targets installed by rustup are
# invisible to the compiler launched by Cargo.
if [[ -n "$rustup_cargo" ]]; then
    export PATH="$(dirname "$cargo_bin"):$PATH"
fi

if ! "$cargo_bin" ndk --version >/dev/null 2>&1; then
    echo "cargo-ndk is required; install it with: cargo install cargo-ndk" >&2
    exit 1
fi

cd "$repo_root/mdi-android-jni"
rm -rf "$output_dir/arm64-v8a" "$output_dir/x86_64"
"$cargo_bin" ndk \
  --target arm64-v8a \
  --target x86_64 \
  --platform 23 \
  -o "$output_dir" \
  build --release

# `mdi-core` declares a cdylib for other hosts, so cargo-ndk also copies that
# dependency as a by-product. The JNI façade links the core statically; only
# its own library belongs in the AAR.
rm -f "$output_dir/arm64-v8a/libmdi_core.so" "$output_dir/x86_64/libmdi_core.so"
