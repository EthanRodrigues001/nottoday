import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { features, isUsable, predict, train, type Example } from './naive-bayes.ts';

const yes = (text: string): Example => ({ text, label: 'yes' });
const no = (text: string): Example => ({ text, label: 'no' });

const examples: Example[] = [
  yes('Submit the DBMS assignment by Friday'),
  yes('Lab record due tomorrow please upload'),
  yes('Assignment 4 deadline is 12 Nov'),
  yes('kal tak assignment jama karo'),
  yes('Project report submission on Monday'),
  yes('Upload the worksheet before 5pm'),
  no('Class cancelled today'),
  no('Good morning everyone'),
  no('Anyone has notes for chapter 3?'),
  no('Meeting at the canteen after class'),
  no('Happy diwali to all'),
  no('Please share the photos from the trip'),
];

describe('features', () => {
  it('includes words and neighbouring pairs once each', () => {
    assert.deepEqual(features('Submit the report the report').sort(), ['report', 'report_the', 'submit', 'submit_the', 'the', 'the_report'].sort());
  });
  it('handles Devanagari', () => {
    assert.ok(features('कल तक असाइनमेंट जमा करें').includes('असाइनमेंट'));
  });
});

describe('naive Bayes', () => {
  const model = train(examples);

  it('is not usable until it has seen enough of both kinds', () => {
    assert.equal(isUsable(train(examples.slice(0, 4))), false);
    assert.equal(isUsable(model), false); // 12 examples is below the minimum total
    assert.equal(isUsable(train([...examples, ...examples, ...examples])), true);
  });

  it('rates task-like messages high and chatter low', () => {
    assert.ok(predict(model, 'Submit the lab assignment by Monday') > 0.8);
    assert.ok(predict(model, 'Good morning, class cancelled') < 0.2);
  });

  it('learns a word the rules never knew', () => {
    const custom = train([...examples, yes('Bring the logbook tomorrow'), yes('Logbook check on Thursday'), yes('Carry your logbook')]);
    assert.ok(predict(custom, 'logbook needed') > predict(model, 'logbook needed'));
  });

  it('stays between 0 and 1 for any input', () => {
    for (const t of ['', '???', 'a'.repeat(500), 'submit '.repeat(200)]) {
      const p = predict(model, t);
      assert.ok(p >= 0 && p <= 1 && Number.isFinite(p));
    }
  });
});
