# Checked benchmark mathematics

This native Lean project imports CogniPilot's `GNC.Planning.SmoothStep` and its verification policy. It checks a real-number specification of the fixed figure-eight benchmark. It does **not** prove the complete simulator, either flight controller, or a physical drone correct.

## Reproduce

Install the official Lean toolchain specified by `lean-toolchain` (Lean 4.29.1), normally using Elan. Then, from this directory:

```sh
lake exe cache get
lake build
```

`lake build` includes `ADR.Audit`: admitted proofs, new axioms, and unsafe project declarations fail the build. The only permitted foundational axioms are `propext`, `Classical.choice`, and `Quot.sound`, matching the upstream policy. Cached dependencies are version-pinned; Lake rebuilds changed proof modules.

The library pin is `CogniPilot/gnc_lean@0c01537b94677d38c0547a72c1dc12a7e87db234`. Mathlib and its dependencies use the exact revisions in that library's `flake.lock`. The explicit Lake requirements make its path-based dependency pins usable outside the upstream Linux Nix shell, including macOS. The generated `lake-manifest.json` is committed. Do not update pins casually.

From the repository root, `shasum -a 256 -c proofs/source-snapshot.sha256` checks the implementation/configuration snapshot reviewed alongside these proofs. This is a change detector, **not** a formal equivalence proof between Lean and Rust/JavaScript. Review mathematical correspondence before updating the hashes. CI runs the snapshot check and Lean build.

## Scope

October 16 FastDyn transport review: the recorded source snapshot includes the ARM shared-memory transport and the existing runner calibration diagnostics. The trajectory equations and shared position-loop mathematics are unchanged. Updating this change-detection hash is not a new Lean proof of the transport, firmware, calibration, or emulated flight; those are checked empirically and reported separately.

See [the coverage ledger](../docs/formal-verification.md), [the theorem source](ADR/Benchmark.lean), and [local verification record](verification.json). Proofs do not themselves change flight logic. The October 4 acceleration-feedforward experiment supplies new empirical evidence; the snapshot records the reviewed source/config update. The whole upstream GNC library is not rebuilt here: only imported proof modules and their dependencies are checked.

## October 9 snapshot review

Compared the current Cerebri patch with the reviewed October 5 snapshot at `eb293dc5fa3b53daad69ad96d2621f98016f5d55`. All existing mathematical implementation sections, including `figure_config.rs`, `reference.rs` and the historical adapters, are byte-identical. Changes are limited to command registration, an optional ideal-attitude plant input, and new `shared_loop.rs`, `shared_loop_shim.c`, `shared_sil.rs` files. No patch sections were removed. The five other snapshot files are unchanged. The Cerebri checksum is refreshed after this review; the Lean specification and axiom allowlist remain unchanged.

This does **not** extend formal coverage to the new eFMU controller, simulator scheduler, landing detector or firmware. The new minimum-jerk trajectory uses the same analytic figure-eight equations, but its generated floating-point implementation has numerical checks rather than a refinement proof. See the [coverage ledger](../docs/formal-verification.md).

## October 13 feed-forward review

The existing `figure_config.rs`, `reference.rs`, and `speed_score.rs` patch sections were compared byte-for-byte with the previous reviewed snapshot and are unchanged. The Cerebri snapshot now additionally includes shared-controller feed-forward transport, firmware bindings and native experiment code. Its checksum is updated as a change detector, not as a proof of these additions.

New nominal-trajectory jerk, snap, body-rate and angular-acceleration calculations have independent numerical derivative checks. The Lean theorems do **not** establish equivalence to these generated calculations, closed-loop stability, failsafe correctness, or hardware safety. See [the feed-forward implementation record](../docs/feedforward-update.md).

## October 22 normal-stick and ARM integration review

The five non-Cerebri snapshot files still match their recorded hashes. The
figure_config.rs, reference.rs and speed_score.rs patch sections were compared
byte-for-byte with commit eba3c5662b55326b9d0c22e32a37a4d1c2e1276b and are unchanged.
Reviewed the unchanged analytic x=A sin(q), y=B sin(2q), quintic phase, chain-rule
derivatives and containment interpretation against ADR/Benchmark.lean.
The Cerebri snapshot is refreshed for simulator transport, normal-stick tilt lead,
gain tuning, export and screening changes. None of these additions is covered by
the Lean specification; this is a change-detector update, not a proof of the new
controller behavior. The Lean sources, dependency pins and axiom policy are unchanged.
