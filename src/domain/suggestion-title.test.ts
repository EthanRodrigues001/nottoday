import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { suggestionTitle } from './suggestion-title.ts';

describe('suggestionTitle', () => {
  it('keeps a short message as is, without the trailing full stop', () => {
    assert.equal(suggestionTitle('Submit the DBMS assignment by Friday.'), 'Submit the DBMS assignment by Friday');
  });

  it('drops a greeting and keeps the first sentence', () => {
    assert.equal(
      suggestionTitle('Hello everyone, submit the lab record by Friday. Late work will not be accepted.'),
      'Submit the lab record by Friday',
    );
  });

  it('cuts long text', () => {
    const t = suggestionTitle('a'.repeat(200));
    assert.equal(t.length, 80);
    assert.ok(t.endsWith('…'));
  });

  it('uses the first line of a multi-line message', () => {
    assert.equal(suggestionTitle('Assignment 4 due Monday\nPlease read the rules'), 'Assignment 4 due Monday');
  });

  it('never returns an empty title', () => {
    assert.ok(suggestionTitle('Hi!').length > 0);
  });
});
