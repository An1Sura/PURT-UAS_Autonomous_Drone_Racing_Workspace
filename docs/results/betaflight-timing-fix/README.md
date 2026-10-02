# Betaflight timing correction evidence

Recorded October 2, 2026. The successful run is `1790925641463995931`; its full replay results are in `../single-lap/`. The other JSON files preserve the earlier failed attempts. Full native artifacts remain at `src/cerebri_rdd2/artifacts/mission-planner/<run-id>/` in the simulation VM.

The previous public Betaflight recording at commit `3058708d99b23012357f3d7de3010adb4657bd07` passed landing checks but commanded approximately 1.79 figure-eight cycles. Do not treat its old `passed` flag as proof of one lap. The new report adds `native_timing` and independent `lap_verification` fields.
