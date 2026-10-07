export const ROLES = Object.freeze({
  SUPERVISOR: 'cutting_supervisor',
  VERIFIER: 'cutting_verifier',
  SEWING: 'sewing_supervisor'
});

export function classifyCount(actual, expected) {
  if (!Number.isInteger(actual) || actual < 0) throw new Error('Actual count must be a non-negative integer');
  if (!Number.isInteger(expected) || expected < 0) throw new Error('Expected count must be a non-negative integer');
  if (actual === expected) return 'GREEN';
  if (actual > expected) return 'YELLOW';
  return 'RED';
}

export function expectedFabric(stdFabricYards, targetQty) {
  return Number(stdFabricYards) * Number(targetQty);
}

export function calculateWastagePct(actualFabricYds, stdFabricYards, targetQty) {
  const expected = expectedFabric(stdFabricYards, targetQty);
  if (expected <= 0) throw new Error('Expected fabric must be positive');
  return ((Number(actualFabricYds) - expected) / expected) * 100;
}

export function validateApproval(items, role) {
  if (role !== ROLES.VERIFIER) return { ok: false, status: 403, error: 'Only Cutting Verifier may approve batches' };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, status: 422, error: 'Verification items are missing' };
  if (items.some(i => i.actual_qty === null || i.actual_qty === undefined)) return { ok: false, status: 422, error: 'Every component must be counted before approval' };
  if (items.some(i => i.status === 'RED' || Number(i.actual_qty) < Number(i.expected_qty))) return { ok: false, status: 422, error: 'Shortage detected. Approval is blocked.' };
  return { ok: true };
}

export function validateRejection(note, role) {
  if (role !== ROLES.VERIFIER) return { ok: false, status: 403, error: 'Only Cutting Verifier may reject batches' };
  if (!note || !String(note).trim()) return { ok: false, status: 422, error: 'Rejection reason is mandatory' };
  return { ok: true };
}

export function isSewingQueueVisibleStatus(status) {
  return status === 'VERIFIED';
}
