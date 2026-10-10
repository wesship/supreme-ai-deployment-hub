# PRIMETIME Mac Worker Staging Canary

1. Create a dedicated non-admin macOS account on the Mac mini.
2. Install pinned macOS and browser harness versions and record checksums.
3. Grant only the accessibility, automation, screen-recording, and filesystem
   permissions required by harness diagnostics.
4. Configure `PRIMETIME-MAC-01` for staging with one concurrent lease.
5. Submit a disposable task requiring `browser-control` and `visual-qa`.
6. Verify a worker without those capabilities cannot claim it.
7. Verify the Mac obtains exactly one lease and triggers one downstream dispatch.
8. Restart the worker during the lease and verify recovery uses the same task
   idempotency identity without duplicate execution.
9. Run a staging D3VONN visual smoke test and retain evidence in the OCC audit
   trail without secrets or unrelated user data.
10. Drain the worker, verify zero active leases, and revoke its credentials.

Do not activate production until every step passes and an operator approves the
promotion. A capability match is routing only, never permission to bypass the
autonomous-agent safety boundary.
