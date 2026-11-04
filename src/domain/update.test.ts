import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isNewer, parseRelease, parseVersion } from './update.ts';

const release = (over: Record<string, unknown> = {}) => ({
  tag_name: 'v1.2.0',
  body: ' Faster. ',
  draft: false,
  prerelease: false,
  assets: [
    { name: 'notes.txt', browser_download_url: 'https://x/notes.txt', size: 3 },
    { name: 'notToday-1.2.0.apk', browser_download_url: 'https://x/app.apk', size: 55_000_000 },
  ],
  ...over,
});

describe('versions', () => {
  it('reads tags with or without v and short forms', () => {
    assert.deepEqual(parseVersion('v1.2.3'), [1, 2, 3]);
    assert.deepEqual(parseVersion('1.2'), [1, 2, 0]);
    assert.deepEqual(parseVersion('2.0.0-beta.1'), [2, 0, 0]);
    assert.equal(parseVersion('latest'), null);
  });

  it('compares numerically, not as text', () => {
    assert.ok(isNewer('1.10.0', '1.9.0'));
    assert.ok(isNewer('v2.0.0', '1.99.99'));
    assert.ok(isNewer('1.0.1', '1.0.0'));
    assert.ok(!isNewer('1.0.0', '1.0.0'));
    assert.ok(!isNewer('0.9.0', '1.0.0'));
    assert.ok(!isNewer('nonsense', '1.0.0'));
  });
});

describe('parseRelease', () => {
  it('finds the APK and the notes', () => {
    assert.deepEqual(parseRelease(release()), { version: '1.2.0', notes: 'Faster.', apkUrl: 'https://x/app.apk', size: 55_000_000 });
  });

  it('ignores drafts, pre-releases, releases without an APK and junk', () => {
    assert.equal(parseRelease(release({ draft: true })), null);
    assert.equal(parseRelease(release({ prerelease: true })), null);
    assert.equal(parseRelease(release({ assets: [] })), null);
    assert.equal(parseRelease(release({ tag_name: 'nightly' })), null);
    assert.equal(parseRelease({ message: 'Not Found' }), null);
    assert.equal(parseRelease(null), null);
  });
});
