import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseQueueLine } from './queue.ts';

describe('parseQueueLine', () => {
  it('reads a group notification written by the native service', () => {
    const q = parseQueueLine(
      JSON.stringify({
        packageName: 'com.whatsapp',
        title: 'CS Group',
        text: 'Rao: Submit by Friday',
        bigText: null,
        timestamp: 1000,
        seenAt: 2000,
        ongoing: false,
        category: 'msg',
        isGroupConversation: true,
        conversationTitle: 'CS Group',
      }),
    );
    assert.equal(q?.seenAt, 2000);
    assert.equal(q?.raw.title, 'CS Group');
    assert.equal(q?.raw.extras?.['android.isGroupConversation'], true);
    assert.equal(q?.raw.extras?.['android.conversationTitle'], 'CS Group');
    assert.equal(q?.raw.bigText, null);
  });

  it('leaves group extras out of a one-to-one notification', () => {
    const q = parseQueueLine(JSON.stringify({ packageName: 'com.whatsapp', title: 'Neha', text: 'hi', timestamp: 5, isGroupConversation: false }));
    assert.deepEqual(q?.raw.extras, {});
    assert.equal(q?.seenAt, 5);
  });

  it('rejects broken or incomplete lines', () => {
    assert.equal(parseQueueLine('not json'), null);
    assert.equal(parseQueueLine('{}'), null);
    assert.equal(parseQueueLine(JSON.stringify({ packageName: 'com.whatsapp' })), null);
  });
});
