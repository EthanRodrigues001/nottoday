import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { ingestNotification, type Repo, type StoredMessage, type Suggestion } from './ingest.ts';

class FakeRepo implements Repo {
  chats = new Map<string, boolean>();
  messages: (StoredMessage & { sentAt: number })[] = [];
  suggestions: Suggestion[] = [];
  meta = new Map<string, string>();
  taught: { text: string; label: 'yes' | 'no' }[] = [];

  async touchChat(name: string) {
    if (!this.chats.has(name)) this.chats.set(name, true);
    return { enabled: this.chats.get(name)! };
  }
  async recentMessages(chat: string, since: number) {
    return this.messages.filter((m) => m.chat === chat && m.seenAt >= since);
  }
  async addMessage(m: StoredMessage & { sentAt: number }) {
    this.messages.push(m);
  }
  async participants(chat: string) {
    return [...new Set(this.messages.filter((m) => m.chat === chat).map((m) => m.sender))];
  }
  async addSuggestion(s: Suggestion) {
    const same = this.suggestions.some(
      (x) => x.kind === s.kind && x.chat === s.chat && (s.kind === 'birthday' ? x.name === s.name && x.day === s.day : x.snippet === s.snippet),
    );
    if (same) return false;
    this.suggestions.push(s);
    return true;
  }
  async setMeta(key: string, value: string) {
    this.meta.set(key, value);
  }
  async examples() {
    return this.taught;
  }
}

// Wednesday 28 October 2026, 10:00 local
const SENT = new Date(2026, 9, 28, 10, 0).getTime();
const NOW = SENT + 1000;

const wa = (over: Record<string, unknown>) => ({
  packageName: 'com.whatsapp',
  title: 'Neha',
  text: 'hi',
  bigText: null,
  timestamp: SENT,
  category: 'msg',
  ...over,
});

describe('ingestNotification', () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it('drops other apps without storing anything', async () => {
    const r = await ingestNotification(repo, wa({ packageName: 'com.google.android.gm', title: 'Bank', text: 'OTP 1234 by tomorrow' }), NOW);
    assert.deepEqual(r, { kind: 'ignored', reason: 'not WhatsApp' });
    assert.equal(repo.messages.length, 0);
    assert.equal(repo.chats.size, 0);
    assert.equal(repo.meta.size, 0);
  });

  it('suggests a deadline with a resolved date', async () => {
    const r = await ingestNotification(repo, wa({ title: 'CS Group', text: 'Rao: Submit the lab record by Friday 5pm', extras: { 'android.isGroupConversation': true } }), NOW);
    assert.deepEqual(r, { kind: 'stored', suggestions: ['deadline'] });
    const s = repo.suggestions[0];
    assert.equal(s.day, '2026-10-30');
    assert.equal(s.time, '17:00');
    assert.equal(s.chat, 'CS Group');
    assert.equal(s.status, 'pending');
  });

  it('stores plain chatter but suggests nothing', async () => {
    const r = await ingestNotification(repo, wa({ text: 'lol ok' }), NOW);
    assert.deepEqual(r, { kind: 'stored', suggestions: [] });
    assert.equal(repo.messages.length, 1);
  });

  it('skips chats that are switched off', async () => {
    repo.chats.set('Neha', false);
    const r = await ingestNotification(repo, wa({ text: 'Assignment due tomorrow' }), NOW);
    assert.deepEqual(r, { kind: 'ignored', reason: 'chat switched off' });
    assert.equal(repo.suggestions.length, 0);
    assert.equal(repo.messages.length, 0);
  });

  it('ignores a repeated notification and does not duplicate the suggestion', async () => {
    const n = wa({ text: 'Assignment due tomorrow' });
    await ingestNotification(repo, n, NOW);
    const again = await ingestNotification(repo, n, NOW + 5000);
    assert.deepEqual(again, { kind: 'ignored', reason: 'repeat' });
    assert.equal(repo.suggestions.length, 1);
  });

  it('suggests a birthday from a group wish, using the date it was sent', async () => {
    const r = await ingestNotification(
      repo,
      wa({ title: 'Gang', text: 'Amit: Happy birthday Rahul!!', extras: { 'android.isGroupConversation': true } }),
      NOW,
    );
    assert.deepEqual(r, { kind: 'stored', suggestions: ['birthday'] });
    assert.equal(repo.suggestions[0].name, 'Rahul');
    assert.equal(repo.suggestions[0].day, '2026-10-28');
  });

  it('does not treat a one-to-one wish as someone else\'s birthday', async () => {
    const r = await ingestNotification(repo, wa({ title: 'Neha', text: 'Happy birthday!!' }), NOW);
    assert.deepEqual(r, { kind: 'stored', suggestions: [] });
  });

  it('holds back a rule match the model has learned to reject', async () => {
    for (let i = 0; i < 12; i++) {
      repo.taught.push({ text: 'Submit the assignment by Friday', label: 'yes' });
      repo.taught.push({ text: 'Submit the form by Saturday', label: 'no' });
    }
    const r = await ingestNotification(repo, wa({ text: 'Submit the form by Friday' }), NOW);
    assert.deepEqual(r, { kind: 'stored', suggestions: [] });
    assert.equal(repo.suggestions.length, 0);
  });

  it('leaves the rules alone until the model has enough examples', async () => {
    repo.taught.push({ text: 'Submit the form by Saturday', label: 'no' });
    const r = await ingestNotification(repo, wa({ text: 'Submit the form by Friday' }), NOW);
    assert.deepEqual(r, { kind: 'stored', suggestions: ['deadline'] });
  });

  it('records when the last WhatsApp message was seen', async () => {
    await ingestNotification(repo, wa({ text: 'hello' }), NOW);
    assert.equal(repo.meta.get('last_message_at'), String(NOW));
  });
});
