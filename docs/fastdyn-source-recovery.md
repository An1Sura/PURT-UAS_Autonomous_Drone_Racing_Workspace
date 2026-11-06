# FastDyn source recovery — November 6, 2026

A fresh CI checkout currently fails before building: upstream branch `fix/cerebri-fastdyn-lockstep` no longer exists. GitHub's commit API also returns “No commit found” for both historical pins below in `jgoppert/FastDyn`. Checks against `boardrunner2049/FastDyn` did not recover either pin. The current remote `main` resolves to `a720f4ecc54cfcc6ecc3002d4880db261f240191`; it has **not** been substituted into the experiment.

| Role | Preserved commit | Bundle SHA-256 |
|---|---|---|
| Tested FastDyn ARM runtime | `94c85f3e47be410e8d760b7f8207eb1580d7cd4c` | `761d9479ee81812be34e8256ec5cb8ad81f4c7ce32527becd969a20c97984d61` |
| Earlier Devenv source pin | `c235932a60a7bb839e59cac111920fb3b5cbf1aa` | `4a07e16d4b2217d51da7a1c90c9999a9172684d244ffc5efe49173545782e064` |

Complete Git-history bundles were created from the surviving VM checkouts and passed `git bundle verify`. Copies on the Mac were independently SHA-256 checked. They are retained locally under `artifacts/source-recovery/`:

- `fastdyn-tested-94c85f3.bundle` (about 204 MiB)
- `fastdyn-workspace-c235932.bundle` (about 227 MiB)
- `fastdyn-tested-working-tree.patch` (tracked changes to the tested checkout)
- `fastdyn-recovery.sha256`

These large source archives are **not published in this repository or downloadable from Pages**. The VM's original editable checkouts remain intact. Duplicate VM backup files were removed after verifying the Mac copies to preserve space for flight traces.

From a supplied bundle, Git can restore the original history directly:

```sh
git clone /path/to/fastdyn-tested-94c85f3.bundle FastDyn-restored
git -C FastDyn-restored rev-parse HEAD
```

Recovering a commit alone does not reproduce the entire patched experiment. Apply the recorded source patches and untracked adapter headers/tests, obtain the pinned QEMU and Modelica dependencies, and verify firmware/plant/library hashes. The checked ArduPilot hooks are specific to its exact ELF. See the [qualification audit](evidence/qualification-2026-11-06/README.md).

This source-availability problem does not invalidate previously recorded traces or stop the existing VM flights. It **does** block clean network-only reproduction and the current cache workflow. Restoring an upstream archive or publishing a maintained source mirror is required before claiming that a new teammate can reproduce everything from GitHub alone. No untested replacement pin has been selected merely to make CI green.
