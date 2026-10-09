# October 9 CI repair

The screenshot's three platform failures shared one cause: nixfmt reformatted devenv/tasks.nix and statix rejected redundant parentheses around the figure-plan task. The task file is now formatted and lint-clean. A clean aarch64 Linux checkout passed the canonical Devenv CI test locally.

The cache failure was Rumoca 0.10.0's stale Cargo vendor checksum. The pinned clean upstream flake expected sha256-tS1YJQiDgGITMPLDj7d560HNZfLDyWwgFcYLNjVWy1k=, while Nix fetched sha256-mxdYllug5q0FaplS6w5XGCuy0IO4igPc3J/U7X4fT0c=. The repository already carried the reviewed correction in patches/rumoca-runtime-fixes.patch, but fresh CI checkouts never applied it. A native Devenv dependency now applies only that patch's flake.nix hunk before Rumoca cache/Python builds. It checks the exact source revision, accepts an already-applied fix, and fails on conflicting edits. No hash checks or build targets were disabled. The repaired cache target passed locally.

The separate Lean workflow's source-snapshot failure came from the new shared SIL code changing the bundled Cerebri patch. A comparison against the last reviewed patch found the historical mathematical sections unchanged. See proofs/README.md for the review scope; the snapshot update does not claim formal proof of the new firmware or harness.
