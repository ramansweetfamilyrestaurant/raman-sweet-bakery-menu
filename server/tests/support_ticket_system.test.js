import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_CATEGORIES,
  CATEGORY_ALIASES,
  VALID_CATEGORIES,
  VALID_PRIORITIES,
  VALID_STATUSES,
  normalizeCategory,
  generateTicketReference,
  validateTicketInput,
  validateReplyInput,
  validateStatusTransition
} from '../services/supportTicketService.js';

describe('Support Ticket System Validation & Logic', () => {
  it('1. Canonical categories & aliases normalize properly', () => {
    assert.equal(normalizeCategory('hardware'), 'printer');
    assert.equal(normalizeCategory('table_qr'), 'qr');
    assert.equal(normalizeCategory('account'), 'other');
    assert.equal(normalizeCategory('orders'), 'orders');
    assert.equal(normalizeCategory('kds'), 'kds');
    assert.equal(normalizeCategory('invalid_category'), null);
  });

  it('2. Ticket references match format TKT-YYYYMMDD-XXXXXX', () => {
    const ref = generateTicketReference();
    assert.match(ref, /^TKT-\d{8}-[A-F0-9]{6}$/);
  });

  it('3. Ticket creation payload validation handles good and bad inputs', () => {
    const valid = validateTicketInput({
      subject: 'Thermal printer error in Kitchen',
      category: 'printer',
      message: 'Printer is not cutting paper automatically on counter 1.',
      priority: 'high'
    });
    assert.equal(valid.isValid, true);
    assert.equal(valid.data.category, 'printer');
    assert.equal(valid.data.priority, 'high');

    const invalid = validateTicketInput({
      subject: 'a',
      category: 'invalid',
      message: 'bad',
      priority: 'urgent_now'
    });
    assert.equal(invalid.isValid, false);
    assert.ok(invalid.errors.length >= 3);
  });

  it('4. Reply message input validation works', () => {
    const validReply = validateReplyInput('We are looking into this right now.');
    assert.equal(validReply.isValid, true);
    assert.equal(validReply.data, 'We are looking into this right now.');

    const emptyReply = validateReplyInput('   ');
    assert.equal(emptyReply.isValid, false);
  });

  it('5. Status transitions validate lifecycle rules', () => {
    // Open -> In Progress (Valid)
    const t1 = validateStatusTransition('open', 'in_progress');
    assert.equal(t1.isValid, true);

    // Resolved -> Open (Valid reopen)
    const t2 = validateStatusTransition('resolved', 'in_progress');
    assert.equal(t2.isValid, true);

    // Invalid target status
    const t3 = validateStatusTransition('open', 'nonsense_status');
    assert.equal(t3.isValid, false);
  });
});

