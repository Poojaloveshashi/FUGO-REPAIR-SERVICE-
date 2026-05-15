# Security Spec for Fugo Repair

## Data Invariants
1. A repair request must belong to the user who created it (as customer).
2. Only technicians or admins can move a request to "warehouse" or "repairing".
3. Customers can only see their own requests.
4. Technicians can see all requests assigned to them (or all if simplified for this app).

## The Dirty Dozen Payloads (Rejection Tests)
1. **The Spoof:** Create `RepairRequest` with a different `userId`. (DENY)
2. **The Status Jump:** Customer tries to set status to `completed` directly. (DENY)
3. **The Ghost Key:** Update `RepairRequest` with `isVerified: true`. (DENY)
4. **The Shadow Log:** Add log to a request I don't own. (DENY)
5. **The Role Escalation:** User updates their own profile `role` to 'admin'. (DENY)
6. **The ID Poisoning:** Document ID with 1KB string. (DENY)
7. **The PII Leak:** Get another user's private profile. (DENY)
8. **The Immutable Break:** Change `createdAt` on update. (DENY)
9. **The Blank Request:** Create request with only `status` field. (DENY)
10. **The Anonymous Write:** Write to `users` without auth. (DENY)
11. **The Terminal Edit:** Update a request with status `completed`. (DENY)
12. **The Size Attack:** 1MB string in `description`. (DENY)

## Final Rules Logic
- `isSignedIn()`
- `isOwner(id)`
- `isTechnician()`
- `isValidRepairRequest()`
- `isValidUserProfile()`
- `isValidRepairLog()`
