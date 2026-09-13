import assert from 'node:assert/strict';
import test from 'node:test';
import { nextReleaseVersion, releaseClosure } from './release-version-policy.mjs';

test('starts a new minor at zero and keeps normal patch behavior', () => {
  assert.equal(nextReleaseVersion({baseline:'2.0.6', series:'2.1'}), '2.1.0');
  assert.equal(nextReleaseVersion({baseline:'2.0.6', published:['2.0.9']}), '2.0.10');
  assert.equal(nextReleaseVersion({baseline:'2.1.0', series:'2.1', published:['2.1.0','2.1.2'], tagged:['2.1.3']}), '2.1.4');
});
test('exact target is repeatable before publication and rejects occupied artifacts', () => {
  const input = {baseline:'2.0.6', targetVersion:'2.1.0'};
  assert.equal(nextReleaseVersion(input), nextReleaseVersion(input));
  assert.equal(nextReleaseVersion({...input,baseline:'2.1.0'}), '2.1.0');
  for (const state of [{published:['2.1.0']}, {tagged:['2.1.0']}]) {
    assert.throws(() => nextReleaseVersion({...input,...state}), /conflict/);
  }
  assert.throws(() => nextReleaseVersion({...input,targetVersion:'2.0.1'}), /precedes/);
  assert.throws(() => nextReleaseVersion({...input,targetVersion:'2.1'}), /stable/);
});
test('dependency closure includes optional and peer consumers transitively', () => {
  const manifests = [{name:'core'}, {name:'mdi',dependencies:{core:'workspace:*'}}, {name:'remark',peerDependencies:{mdi:'workspace:*'}}, {name:'cli',optionalDependencies:{remark:'workspace:*'}}, {name:'other'}];
  assert.deepEqual([...releaseClosure(manifests, ['core'])], ['core','mdi','remark','cli']);
});
