import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isRepeat, parseWhatsAppNotification, type RawNotification } from './whatsapp.ts';

const base: RawNotification = {
  packageName: 'com.whatsapp',
  title: null,
  text: null,
  bigText: null,
  timestamp: Date.UTC(2026, 9, 28, 4, 30),
  category: 'msg',
};

const note = (over: Partial<RawNotification>): RawNotification => ({ ...base, ...over });

function message(over: Partial<RawNotification>) {
  const r = parseWhatsAppNotification(note(over));
  assert.equal(r.kind, 'message', r.kind === 'ignored' ? r.reason : '');
  return r.kind === 'message' ? r.message : (undefined as never);
}

function reason(over: Partial<RawNotification>) {
  const r = parseWhatsAppNotification(note(over));
  assert.equal(r.kind, 'ignored');
  return r.kind === 'ignored' ? r.reason : '';
}

describe('parseWhatsAppNotification', () => {
  it('reads a one-to-one message', () => {
    const m = message({ title: 'Neha', text: 'Assignment due kal' });
    assert.deepEqual([m.chat, m.sender, m.text, m.isGroup], ['Neha', 'Neha', 'Assignment due kal', false]);
  });

  it('reads a group message flagged by Android, sender in the body', () => {
    const m = message({
      title: 'CS 3rd Year',
      text: 'Mr Rao: Submit the lab record by Friday',
      extras: { 'android.isGroupConversation': true, 'android.conversationTitle': 'CS 3rd Year' },
    });
    assert.deepEqual([m.chat, m.sender, m.text, m.isGroup], ['CS 3rd Year', 'Mr Rao', 'Submit the lab record by Friday', true]);
  });

  it('reads a group message flagged by Android, sender in the title', () => {
    const m = message({
      title: 'Mr Rao',
      text: 'Submit the lab record by Friday',
      extras: { 'android.isGroupConversation': true, 'android.conversationTitle': 'CS 3rd Year' },
    });
    assert.deepEqual([m.chat, m.sender, m.text], ['CS 3rd Year', 'Mr Rao', 'Submit the lab record by Friday']);
  });

  it('treats "Name: text" under a different title as a group when not flagged', () => {
    const m = message({ title: 'Class 12B', text: 'Anita: bring ID card tomorrow' });
    assert.deepEqual([m.chat, m.sender, m.text, m.isGroup], ['Class 12B', 'Anita', 'bring ID card tomorrow', true]);
  });

  it('keeps a colon inside a one-to-one message', () => {
    const m = message({ title: 'Neha', text: 'Note: submit tomorrow' });
    assert.equal(m.isGroup, true); // ambiguous by nature: a short "Note" prefix looks like a sender
    assert.equal(m.chat, 'Neha');
  });

  it('does not split a long sentence before a colon', () => {
    const m = message({ title: 'Neha', text: 'Please remember the following points for tomorrow: bring ID' });
    assert.equal(m.isGroup, false);
    assert.equal(m.text, 'Please remember the following points for tomorrow: bring ID');
  });

  it('strips the message count from stacked titles', () => {
    assert.equal(message({ title: 'Neha (3 messages)', text: 'hello' }).chat, 'Neha');
  });

  it('prefers the long text over the shortened one', () => {
    const m = message({ title: 'Neha', text: 'Please submit the…', bigText: 'Please submit the whole report by Monday' });
    assert.equal(m.text, 'Please submit the whole report by Monday');
  });

  it('removes invisible direction marks', () => {
    assert.equal(message({ title: '‪Neha‬', text: '‎hello' }).chat, 'Neha');
  });

  it('supports WhatsApp Business', () => {
    assert.equal(message({ packageName: 'com.whatsapp.w4b', title: 'Shop', text: 'hi' }).chat, 'Shop');
  });

  it('uses the timestamp as the sent time', () => {
    assert.equal(message({ title: 'Neha', text: 'hi' }).sentAt.getTime(), base.timestamp);
  });
});

describe('parseWhatsAppNotification: ignored', () => {
  it('other apps', () => assert.equal(reason({ packageName: 'com.google.android.gm', title: 'x', text: 'y' }), 'not WhatsApp'));
  it('summaries', () => {
    assert.equal(reason({ title: 'WhatsApp', text: '5 new messages from 2 chats' }), 'summary');
    assert.equal(reason({ title: 'Neha', text: '3 new messages' }), 'summary');
  });
  it('calls', () => assert.equal(reason({ title: 'Neha', text: 'Incoming voice call', category: 'call' }), 'category call'));
  it('deleted messages', () => assert.equal(reason({ title: 'Neha', text: 'This message was deleted' }), 'deleted'));
  it('reactions', () => assert.equal(reason({ title: 'Neha', text: 'Reacted 👍 to "Submit by Friday"' }), 'reaction'));
  it('media only', () => {
    assert.equal(reason({ title: 'Neha', text: '📷 Photo' }), 'media only');
    assert.equal(reason({ title: 'Neha', text: 'Voice message' }), 'media only');
  });
  it('ongoing', () => assert.equal(reason({ title: 'Neha', text: 'x', ongoing: true }), 'ongoing'));
  it('empty', () => assert.equal(reason({ title: 'Neha', text: '' }), 'empty'));
});

describe('isRepeat', () => {
  const m = message({ title: 'Neha', text: 'Submit by Friday' });
  const seen = [{ chat: 'Neha', sender: 'Neha', text: 'Submit by Friday', seenAt: 1_000_000 }];

  it('flags the same message inside the window', () => assert.equal(isRepeat(seen, m, 1_000_000 + 60_000), true));
  it('lets it through after the window', () => assert.equal(isRepeat(seen, m, 1_000_000 + 11 * 60_000), false));
  it('lets a different text through', () => assert.equal(isRepeat(seen, { ...m, text: 'other' }, 1_000_100), false));
});
