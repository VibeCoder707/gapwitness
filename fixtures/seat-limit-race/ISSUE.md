# Enforce workspace seat limits

## Acceptance criteria

- R1: Creating a seat below the workspace limit succeeds.
- R2: Creating a seat at the workspace limit returns HTTP 409.
- R3: Concurrent requests cannot create more seats than the workspace limit.

The implementation must remain safe when two requests observe the same workspace at the same time.
