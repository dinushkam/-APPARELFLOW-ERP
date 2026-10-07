# AI Optimization Report

## 1. Tools & Prompting

AI assistance was used as an engineering accelerator for:

- translating the assessment into a concrete state machine and API surface;
- scaffolding repetitive Next.js route-handler structure;
- reviewing the relational schema against the required business entities;
- suggesting test cases for authorization, shortage blocking, rejection validation, queue isolation, and numeric edge cases;
- improving UI accessibility and input-contrast checks;
- reviewing deployment documentation.

AI output was treated as draft material. Security-sensitive behavior was re-checked against the business rules before inclusion.

## 2. Flawed / Broken AI Code Caught

### Case A — client-only role checks

An early generated approach conditionally hid the "Approve Batch" button when the logged-in role was not `cutting_verifier`, but did not protect the approval API itself. That would allow a user to bypass the UI with Postman/cURL.

**Why it was unacceptable:** frontend visibility is not an authorization boundary.

**Correction:** the final implementation calls `requireRole(['cutting_verifier'])` inside the approval, count, and rejection route handlers. Unauthorized callers receive `403` before business logic runs.

### Case B — trusting the browser's traffic-light state

An early approach proposed accepting component status (`GREEN/YELLOW/RED`) from the request body when approving a batch.

**Why it was unacceptable:** a malicious request could send `GREEN` even when persisted counts represented a shortage.

**Correction:** approval accepts no client-provided decision data. It re-queries all verification items inside a database transaction and evaluates persisted `actual_qty`, `expected_qty`, and status. Missing, uncounted, or RED components produce `422`.

### Case C — mutable audit rows

A basic generated schema allowed normal UPDATE/DELETE operations on `verification_logs`.

**Why it was unacceptable:** verifier attribution and approval evidence are required to be permanent.

**Correction:** verification logs are append-only. PostgreSQL triggers raise an exception on UPDATE or DELETE, and each approval stores a JSONB snapshot of component variances plus verifier ID, timestamp, and wastage percentage.

### Case D — low-contrast generic form styles

A generic dark-theme snippet risked inherited light text inside native dropdowns, especially browser-rendered option lists.

**Why it was unacceptable:** the assessment explicitly identifies white-on-white form controls as a zero-tolerance defect.

**Correction:** all `input`, `select`, and `option` states explicitly use a white background with dark `#111827` text and a visible focus ring.

## 3. Human Refactoring

The final design was hardened in several ways beyond basic scaffolding:

- introduced a domain module (`lib/domain.js`) so traffic-light and gatekeeper rules are deterministic and directly unit-testable;
- added PostgreSQL `CHECK` constraints for roles, states, non-negative counts, and valid decisions;
- wrapped approval/rejection in database transactions;
- added `SELECT ... FOR UPDATE` to prevent two simultaneous verifier actions from racing the same order;
- calculated wastage server-side from the persisted recipe standard and persisted actual fabric usage;
- derived verifier identity from the signed HttpOnly server session rather than request payloads;
- added verified-only SQL query isolation for the Sewing Queue;
- added strict integer guards for component counts and positive guards for order quantities;
- added a recovery path for rejected batches while preserving historical rejection logs.

## 4. Defensive Architecture

### State-control strategy

The client never receives a generic "set status" endpoint. Each legal state transition has its own role-protected server action:

- supervisor creates an order -> `PENDING_VERIFICATION`;
- verifier updates counts while pending;
- verifier approves -> `VERIFIED` only if every persisted component is counted and none is short;
- verifier rejects -> `REJECTED` only with a mandatory note;
- supervisor resubmits a rejected batch -> `PENDING_VERIFICATION` after resetting counts;
- sewing supervisor starts assembly -> `SEWING` only from `VERIFIED`.

This design prevents arbitrary status overrides such as sending `{ status: "VERIFIED" }` from the browser.

### Approval guard

The approval route performs the following sequence:

1. validate authenticated role;
2. lock and load the order from PostgreSQL;
3. require current state `PENDING_VERIFICATION`;
4. load every required component from PostgreSQL;
5. reject any missing/uncounted/RED shortage with HTTP `422`;
6. compute wastage on the server;
7. update the order to `VERIFIED`;
8. append an immutable audit log containing verifier ID, timestamp, wastage, and component variance snapshot;
9. commit the transaction.

### Sewing isolation

The sewing queue API is separately role-protected and its SQL query contains `WHERE o.status = 'VERIFIED'`. It does not accept a user-provided status filter, so manipulating URL parameters cannot reveal pending or rejected batches.

## Final engineering judgment

AI increased implementation speed, but the security model was deliberately designed around a distrustful client. The final application assumes the evaluator can alter browser requests, call APIs manually, and attempt illegal transitions. Therefore every critical rule is re-established from authenticated server context and persisted database state.
