import { describe, expect, test } from 'vitest';
import {
  ROLES,
  classifyCount,
  calculateWastagePct,
  validateApproval,
  validateRejection,
  isSewingQueueVisibleStatus
} from '../lib/domain.js';

describe('ApparelFlow gatekeeper domain rules', () => {
  test('Test 1: all GREEN components can be approved by an authenticated Verifier', () => {
    const items = [
      { expected_qty: 50, actual_qty: 50, status: 'GREEN' },
      { expected_qty: 100, actual_qty: 100, status: 'GREEN' }
    ];
    expect(validateApproval(items, ROLES.VERIFIER)).toEqual({ ok: true });
  });

  test('Test 2: any RED shortage blocks approval with 422', () => {
    const items = [
      { expected_qty: 50, actual_qty: 50, status: 'GREEN' },
      { expected_qty: 100, actual_qty: 99, status: 'RED' }
    ];
    expect(validateApproval(items, ROLES.VERIFIER)).toMatchObject({ ok: false, status: 422 });
  });

  test('Test 3: rejection without a reason is rejected by backend-domain validation', () => {
    expect(validateRejection('   ', ROLES.VERIFIER)).toMatchObject({ ok: false, status: 422 });
  });

  test('Test 4: non-verifier roles receive 403 when attempting approval', () => {
    const items = [{ expected_qty: 10, actual_qty: 10, status: 'GREEN' }];
    expect(validateApproval(items, ROLES.SUPERVISOR)).toMatchObject({ ok: false, status: 403 });
    expect(validateApproval(items, ROLES.SEWING)).toMatchObject({ ok: false, status: 403 });
  });

  test('Test 5: unapproved statuses are never eligible for the Sewing Queue', () => {
    expect(isSewingQueueVisibleStatus('VERIFIED')).toBe(true);
    for (const status of ['PENDING_VERIFICATION', 'REJECTED', 'CUTTING_IN_PROGRESS', 'SEWING']) {
      expect(isSewingQueueVisibleStatus(status)).toBe(false);
    }
  });

  test('traffic-light classification supports GREEN, YELLOW and RED', () => {
    expect(classifyCount(10, 10)).toBe('GREEN');
    expect(classifyCount(11, 10)).toBe('YELLOW');
    expect(classifyCount(9, 10)).toBe('RED');
  });

  test('defensive count validation rejects decimals and negatives', () => {
    expect(() => classifyCount(-1, 10)).toThrow();
    expect(() => classifyCount(2.5, 10)).toThrow();
  });

  test('wastage calculation follows the specified formula', () => {
    expect(calculateWastagePct(94.5, 1.8, 50)).toBeCloseTo(5);
  });
});
