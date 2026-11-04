import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { parseChatExport } from '../domain/chat-export.ts';

import { importChat } from './import.ts';
import type { Suggestion } from './ingest.ts';

class Sink {
  suggestions: Suggestion[] = [];
  taught: { text: string; label: 'yes' | 'no' }[] = [];
  async addSuggestion(s: Suggestion) {
    const same = this.suggestions.some((x) => x.kind === s.kind && x.chat === s.chat && (s.kind === 'birthday' ? x.name === s.name && x.day === s.day : x.snippet === s.snippet));
    if (same) return false;
    this.suggestions.push(s);
    return true;
  }
  async examples() {
    return this.taught;
  }
}

const NOW = new Date(2026, 10, 1, 9, 0).getTime();
const base = { today: '2026-11-01', now: NOW, knowsBirthday: () => false };

const oneToOne = [
  '12/11/2024, 8:00 am - Me: happy birthday Rahul!!',
  '12/11/2025, 8:01 am - Me: Many happy returns of the day Rahul',
  '05/01/2024, 10:00 am - Rahul: Assignment due 8 Jan, submit the report',
  '28/10/2026, 10:00 am - Rahul: Submit the lab record by 20 Nov',
  '28/10/2026, 10:05 am - Me: ok',
].join('\n');

describe('importChat, one-to-one', () => {
  let sink: Sink;
  beforeEach(() => {
    sink = new Sink();
  });

  it('suggests one birthday for the person however many years of wishes there are', async () => {
    const summary = await importChat(sink, parseChatExport(oneToOne), { ...base, chat: 'Rahul', me: ['Me'] });
    assert.equal(summary.birthdays, 1);
    const b = sink.suggestions.find((s) => s.kind === 'birthday')!;
    assert.equal(b.name, 'Rahul');
    assert.equal(b.day?.slice(5), '11-12');
  });

  it('suggests only deadlines that are still ahead', async () => {
    const summary = await importChat(sink, parseChatExport(oneToOne), { ...base, chat: 'Rahul', me: ['Me'] });
    assert.equal(summary.deadlines, 1);
    assert.equal(sink.suggestions.find((s) => s.kind === 'deadline')!.day, '2026-11-20');
  });

  it('skips a birthday that is already saved', async () => {
    const summary = await importChat(sink, parseChatExport(oneToOne), {
      ...base,
      chat: 'Rahul',
      me: ['Me'],
      knowsBirthday: (name, month, day) => name === 'Rahul' && month === 11 && day === 12,
    });
    assert.equal(summary.birthdays, 0);
  });

  it('still finds deadlines when the user has not said which name is theirs', async () => {
    // The import screen asks who "I" am; without it both people count as others, so only deadlines are reliable.
    const summary = await importChat(sink, parseChatExport(oneToOne), { ...base, chat: 'Rahul', me: [] });
    assert.equal(summary.deadlines, 1);
  });
});

describe('importChat, group', () => {
  const group = [
    '12/11/2025, 8:00 am - Me: happy birthday Amit',
    '03/03/2025, 8:00 am - Me: happy birthday!!',
    '20/06/2025, 9:00 am - Neha: Happy birthday Priya!',
    '28/10/2026, 10:00 am - Mr Rao: Project report deadline is 25 Nov',
  ].join('\n');

  it('names people from the text, counts unnamed wishes, and takes wishes from others too', async () => {
    const sink = new Sink();
    const summary = await importChat(sink, parseChatExport(group), { ...base, chat: 'CS Group', me: ['Me'] });
    assert.deepEqual(sink.suggestions.filter((s) => s.kind === 'birthday').map((s) => s.name).sort(), ['Amit', 'Priya']);
    assert.equal(summary.unnamedWishes, 1);
    assert.equal(summary.deadlines, 1);
  });

  it('does not add a rule match the model has learned to reject', async () => {
    const sink = new Sink();
    for (let i = 0; i < 12; i++) {
      sink.taught.push({ text: 'Submit the assignment by Friday', label: 'yes' });
      sink.taught.push({ text: 'Project report deadline is 30 Nov', label: 'no' });
    }
    const summary = await importChat(sink, parseChatExport(group), { ...base, chat: 'CS Group', me: ['Me'] });
    assert.equal(summary.deadlines, 0);
  });
});
