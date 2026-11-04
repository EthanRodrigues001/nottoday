import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyDeadline, findBirthdayWish } from './classifier.ts';
import { findDate, findTime } from './message-date.ts';

// Wednesday 28 October 2026, 10:00
const WED = new Date(2026, 9, 28, 10, 0);

const day = (text: string, sent: Date = WED) => findDate(text, sent)?.day ?? null;

describe('findDate', () => {
  it('reads relative English words', () => {
    assert.equal(day('due tomorrow'), '2026-10-29');
    assert.equal(day('submit by tmrw'), '2026-10-29');
    assert.equal(day('submit today'), '2026-10-28');
    assert.equal(day('day after tomorrow'), '2026-10-30');
    assert.equal(day('in 3 days'), '2026-10-31');
  });

  it('reads weekdays, including next and short forms after a preposition', () => {
    assert.equal(day('by friday'), '2026-10-30');
    assert.equal(day('next friday'), '2026-11-06');
    assert.equal(day('by sat'), '2026-10-31');
    assert.equal(day('I sat there'), null);
    assert.equal(day('on wednesday'), '2026-10-28');
  });

  it('reads Hinglish', () => {
    assert.equal(day('kal tak jama karo'), '2026-10-29');
    assert.equal(day('parso tak submit karna'), '2026-10-30');
    assert.equal(day('shukravar ko lab hai'), '2026-10-30');
    assert.equal(day('3 din mein dena hai'), '2026-10-31');
  });

  it('does not read kal as tomorrow when it is clearly past', () => {
    assert.equal(day('kal class thi'), null);
  });

  it('reads Hindi in Devanagari', () => {
    assert.equal(day('कल तक असाइनमेंट जमा करें'), '2026-10-29');
    assert.equal(day('परसों परीक्षा है'), '2026-10-30');
    assert.equal(day('शुक्रवार तक'), '2026-10-30');
    assert.equal(day('आज जमा करें'), '2026-10-28');
  });

  it('reads written dates, day first', () => {
    assert.equal(day('deadline 12/11'), '2026-11-12');
    assert.equal(day('deadline 12-11-2026'), '2026-11-12');
    assert.equal(day('exam on 3 Nov'), '2026-11-03');
    assert.equal(day('exam on November 3rd'), '2026-11-03');
    assert.equal(day('due 15th dec 2026'), '2026-12-15');
  });

  it('rolls a date with no year into next year when it is long past', () => {
    assert.equal(day('due 3/3'), '2027-03-03');
    assert.equal(day('due 5 jan', new Date(2026, 11, 28)), '2027-01-05');
  });

  it('does not mistake a time for a date', () => {
    assert.equal(day('meet at 5.30pm'), null);
    assert.equal(day('price is 12.50'), null);
  });

  it('prefers an explicit date over a relative word', () => {
    assert.equal(day('not today, due 12/11'), '2026-11-12');
  });

  it('marks next week as approximate', () => {
    const f = findDate('submit next week', WED);
    assert.equal(f?.day, '2026-11-04');
    assert.equal(f?.approximate, true);
  });

  it('rejects impossible dates', () => {
    assert.equal(day('31/2'), null);
    assert.equal(day('45/13'), null);
  });
});

describe('findTime', () => {
  it('reads am/pm and 24-hour times', () => {
    assert.equal(findTime('by 5pm'), '17:00');
    assert.equal(findTime('11:59 pm'), '23:59');
    assert.equal(findTime('at 9:30 am'), '09:30');
    assert.equal(findTime('12 am'), '00:00');
    assert.equal(findTime('at 17:30'), '17:30');
    assert.equal(findTime('no time here'), null);
  });
});

describe('classifyDeadline: should suggest', () => {
  const yes = [
    'Submit the DBMS assignment by Friday 5pm',
    'Assignment 3 is due tomorrow',
    'kal tak assignment jama karo',
    'कल तक असाइनमेंट जमा करें',
    'Please upload the lab record before 12/11',
    'Project report deadline is 3 Nov',
    'Exam on 3 Nov at 9:30 am',
    'Send the form by tonight',
    'parso tak ppt bhejo',
    'Last date for fee payment is 5th November',
  ];
  for (const text of yes) {
    it(text, () => {
      const v = classifyDeadline(text, WED);
      assert.equal(v.isDeadline, true, `score ${v.score} (${v.reasons.join('; ')})`);
      assert.ok(v.date, 'should find a date');
    });
  }
});

describe('classifyDeadline: should stay quiet', () => {
  const no = [
    'lol ok',
    'Happy birthday Rahul!!',
    'I already submitted the assignment',
    'Will send tomorrow',
    'kal assignment submit kiya tha',
    'Good morning everyone',
    'Did you finish the assignment?',
    'Meet tomorrow at 5pm',
    'thanks sir, done',
  ];
  for (const text of no) {
    it(text, () => {
      const v = classifyDeadline(text, WED);
      assert.equal(v.isDeadline, false, `score ${v.score} (${v.reasons.join('; ')})`);
    });
  }
});

describe('findBirthdayWish', () => {
  it('finds the name after the wish', () => {
    assert.equal(findBirthdayWish('Happy birthday Rahul!!')?.name, 'Rahul');
    assert.equal(findBirthdayWish('Happy birthday to Rahul Sharma')?.name, 'Rahul Sharma');
    assert.equal(findBirthdayWish('Many happy returns of the day Anjali')?.name, 'Anjali');
    assert.equal(findBirthdayWish('Janamdin mubarak ho Riya')?.name, 'Riya');
    assert.equal(findBirthdayWish('जन्मदिन मुबारक रिया')?.name, 'रिया');
  });

  it('finds @mentions and names before the wish', () => {
    assert.equal(findBirthdayWish('HBD @Priya 🎉')?.name, 'Priya');
    assert.equal(findBirthdayWish('Rahul, happy birthday!')?.name, 'Rahul');
  });

  it('prefers a known participant of the chat', () => {
    assert.equal(findBirthdayWish('happy birthday sharma ji', ['Amit Sharma', 'Neha Rao'])?.name, 'Amit Sharma');
  });

  it('returns a wish with no name when none is given', () => {
    assert.equal(findBirthdayWish('Happy birthday to you')?.name, null);
    assert.equal(findBirthdayWish('happy birthday!!!')?.name, null);
  });

  it('notes belated wishes', () => {
    assert.equal(findBirthdayWish('Belated happy birthday Rahul')?.belated, true);
  });

  it('ignores messages that are not wishes', () => {
    assert.equal(findBirthdayWish('birthday party at 5'), null);
    assert.equal(findBirthdayWish('Submit the assignment'), null);
  });
});
