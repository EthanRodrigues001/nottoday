import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chatNameFromFileName, guessMe, parseChatExport } from './chat-export.ts';

describe('parseChatExport: Android, day first, 12 hour clock', () => {
  const text = [
    '31/10/2026, 11:45 pm - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.',
    '31/10/2026, 11:46 pm - Rahul: Submit the lab record by Friday',
    'and bring the file too',
    '01/11/2026, 9:05 am - Me: ok sir',
    '01/11/2026, 9:06 am - Rahul: <Media omitted>',
    '01/11/2026, 9:07 am - Rahul: This message was deleted',
    '12/11/2026, 12:00 am - Me: happy birthday Rahul!',
  ].join('\n');

  const r = parseChatExport(text);

  it('keeps real messages and drops notices, media and deleted ones', () => {
    assert.deepEqual(r.messages.map((m) => m.sender), ['Rahul', 'Me', 'Me']);
  });

  it('joins continuation lines', () => {
    assert.equal(r.messages[0].text, 'Submit the lab record by Friday\nand bring the file too');
  });

  it('reads day-first dates and the 12 hour clock', () => {
    assert.equal(r.dateOrder, 'day-first');
    assert.deepEqual([r.messages[0].sentAt.getFullYear(), r.messages[0].sentAt.getMonth(), r.messages[0].sentAt.getDate(), r.messages[0].sentAt.getHours()], [2026, 9, 31, 23]);
    assert.equal(r.messages[2].sentAt.getHours(), 0); // 12:00 am is midnight
    assert.equal(r.messages[2].sentAt.getMonth(), 10);
  });

  it('lists the people who wrote', () => {
    assert.deepEqual(r.participants, ['Rahul', 'Me']);
  });
});

describe('parseChatExport: other layouts', () => {
  it('reads month-first dates when the file proves it', () => {
    const r = parseChatExport(['10/31/26, 23:45 - A: hi', '11/02/26, 08:00 - B: hello'].join('\n'));
    assert.equal(r.dateOrder, 'month-first');
    assert.deepEqual([r.messages[1].sentAt.getMonth(), r.messages[1].sentAt.getDate()], [10, 2]);
  });

  it('reads the iPhone layout with brackets and seconds', () => {
    const r = parseChatExport('[31/10/2026, 23:45:12] Neha: assignment due kal');
    assert.equal(r.messages.length, 1);
    assert.equal(r.messages[0].sender, 'Neha');
    assert.equal(r.messages[0].sentAt.getSeconds(), 12);
  });

  it('handles a narrow no-break space before am/pm and direction marks', () => {
    const r = parseChatExport('‎1/11/2026, 9:05 PM - Neha: hello');
    assert.equal(r.messages[0].sentAt.getHours(), 21);
  });

  it('handles Windows line endings and dotted dates', () => {
    const r = parseChatExport('31.10.26, 23:45 - A: one\r\n01.11.26, 00:10 - B: two\r\n');
    assert.equal(r.messages.length, 2);
  });

  it('ignores impossible dates', () => {
    assert.equal(parseChatExport('31/02/2026, 10:00 - A: nope').messages.length, 0);
  });

  it('returns nothing for text that is not an export', () => {
    assert.deepEqual(parseChatExport('just some notes\nnothing else').messages, []);
  });
});

describe('chatNameFromFileName', () => {
  it('takes the name after "WhatsApp Chat with"', () => {
    assert.equal(chatNameFromFileName('WhatsApp Chat with Rahul Sharma.txt'), 'Rahul Sharma');
    assert.equal(chatNameFromFileName('WhatsApp Chat with CS 3rd Year (1).txt'), 'CS 3rd Year');
  });
  it('falls back to the file name', () => {
    assert.equal(chatNameFromFileName('class-notes.txt'), 'class-notes');
  });
});

describe('guessMe', () => {
  it('picks the name that appears in nearly every chat', () => {
    const chats = [
      { participants: ['Ethan', 'Rahul'] },
      { participants: ['Ethan', 'Priya'] },
      { participants: ['Ethan', 'Sir', 'Amit'] },
    ];
    assert.deepEqual(guessMe(chats), ['Ethan']);
  });

  it('guesses nothing from a single chat or when nobody repeats', () => {
    assert.deepEqual(guessMe([{ participants: ['Ethan', 'Rahul'] }]), []);
    assert.deepEqual(guessMe([{ participants: ['A', 'B'] }, { participants: ['C', 'D'] }]), []);
  });
});
