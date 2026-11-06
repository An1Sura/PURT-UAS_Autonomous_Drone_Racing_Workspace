# ArduPilot filesystem integration — awaiting QEMU qualification

This is preparatory adapter work, not an ArduPilot flight result. Betaflight's speed campaign and the queued CogniPilot campaign retain exclusive use of QEMU. No arming check was disabled to address this blocker.

## Exact target and evidence

The FastDyn-supplied ArduCopter binary has SHA-256 `3fc6ee14e94f5f8b4133b06747145a8e40c7755940b9f87fdab1ad4323c0aa8c`. Its embedded `AP_FWVersion::fwver` identifies ArduCopter 4.6.2, ChibiOS `88b84600`, and firmware source hash `1ebd4d99`. That hash resolves to [ArduPilot commit 1ebd4d996e8b6bbeb1462a9655c00aa861d5beef](https://github.com/ArduPilot/ardupilot/commit/1ebd4d996e8b6bbeb1462a9655c00aa861d5beef), which was fetched without replacing the existing source checkout. Embedded metadata identifies the intended source; a reproducible binary rebuild remains unverified.

The ELF contains `HAL_BOARD_LOG_DIRECTORY "/APM/LOGS"`. The previous adapter rejected every absolute path, so it rejected this actual firmware path. Its inherited open callback also ignored requested access flags and always created files read/write. The firmware's logger additionally uses `stat`, `mkdir`, directory enumeration and disk-capacity queries that the earlier callback list did not provide.

## Changes prepared and built

- Guest `/APM/LOGS` is now rooted under `FASTDYN_FLIGHT_LOG_DIR`, rather than addressing the host filesystem's `/APM/LOGS`. Path traversal and symlink following are rejected.
- ARM newlib read/write/create/truncate/append/exclusive flags are explicitly translated to host flags. Missing read-only files remain missing.
- File information is serialized into the exact 88-byte little-endian guest `stat` layout verified from DWARF. Host structures are not copied into guest memory. Oversized files and unsupported object types fail rather than truncating metadata.
- Added callbacks for `stat`, `mkdir`, `lseek`, available capacity and total capacity. Capacity comes from the actual host filesystem, not an invented number.
- Error returns update the current guest reentrancy structure: `__errno` uses `_impure_ptr` at `0x20002200`, and DWARF puts `_reent::_errno` at offset zero. Common host errors are translated to newlib values; unsupported errors map to I/O failure.
- Fixed the inherited 100-entry file-descriptor registry: failed opens no longer consume entries, closed slots are reused, and exhaustion returns failure instead of writing beyond the array.

These addresses apply only to the pinned binary. `fastdyn/ardupilot/checked-hooks/virtuals.txt` records them. The scoped FastDyn patch includes the implementation and helper headers; it passes reverse-apply validation against the modified pinned checkout.

## Verification and remaining work

Native C tests pass on macOS and Linux for byte layout, open-flag translation, size overflow, real write/read/stat operations, missing files, absolute guest paths, path traversal, symlinks and actual disk-capacity queries. The actual descriptor-registry functions also passed failed-open, capacity and 10,000 close/reuse checks under AddressSanitizer and UndefinedBehaviorSanitizer on macOS. The isolated ArduPilot plugin builds successfully with two pre-existing C23 label/declaration warnings. Its SHA-256 is `7f3fe93740bea08504f5d69247c05d9e0ae8855b0f41b27bd4ac8b3946e2274d`.

Before running, provide a fresh simulation storage directory with an `APM` child, using `FASTDYN_FLIGHT_LOG_DIR` to select it. Let firmware create `LOGS`. The current VM preparation uses the default `artifacts/fastdyn-pinned/flight_logs/APM` directory.

**Not yet qualified:** these callback changes have not run through a new QEMU commissioning attempt. Attempt 11 is queued after the CogniPilot campaign; it checks that no other QEMU process is active before starting and has a 900-second wall-time limit. Directory enumeration, unlink/rename and the complete filesystem API are still not implemented. Terrain allocation remains a separate blocker. A successful plugin build does not establish logging health, arming, takeoff, figure-eight tracking or landing. Attempt 10 remains the latest flight-commissioning evidence and refused arming.

Native checks:

```sh
cc -std=c11 -D_DEFAULT_SOURCE -Wall -Wextra -Werror fastdyn/ardupilot/tests/test_filesystem_abi.c -o /tmp/adr-fs-abi
/tmp/adr-fs-abi
cc -std=c11 -D_DEFAULT_SOURCE -Wall -Wextra -Werror fastdyn/ardupilot/tests/test_filesystem_host.c -o /tmp/adr-fs-host
/tmp/adr-fs-host
```

On macOS use `-D_DARWIN_C_SOURCE` instead of `-D_DEFAULT_SOURCE`.
