import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyReleaseVersions, integrity, registryArtifactMatches, validateReleaseManifest, verifyReleaseArtifacts } from './release-artifacts.mjs';

const sha = 'a'.repeat(40);
const artifact = {name:'test-package',version:'2.1.0',filename:'test-package-2.1.0.tgz',integrity:integrity('original artifact')};
const manifest = {version:1,sourceSha:sha,artifacts:[artifact]};
test('recovery verifies the original SHA and bytes before reusing versions',()=>{
  const directory = mkdtempSync(join(tmpdir(),'mdi-release-test-'));
  try {
    writeFileSync(join(directory,artifact.filename),'original artifact');
    assert.equal(verifyReleaseArtifacts(manifest,directory,sha),manifest);
    assert.throws(()=>verifyReleaseArtifacts(manifest,directory,'b'.repeat(40)),/candidate SHA/);
    writeFileSync(join(directory,artifact.filename),'replacement artifact');
    assert.throws(()=>verifyReleaseArtifacts(manifest,directory,sha),/integrity mismatch/);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
test('partial publication skips only identical immutable versions',()=>{
  assert.equal(registryArtifactMatches(artifact,undefined),false);
  assert.equal(registryArtifactMatches(artifact,artifact.integrity),true);
  assert.throws(()=>registryArtifactMatches(artifact,integrity('foreign')),/conflict/);
  assert.throws(()=>validateReleaseManifest({...manifest,artifacts:[artifact,artifact]},sha),/Duplicate/);
  assert.throws(()=>validateReleaseManifest({...manifest,artifacts:[{...artifact,filename:'../artifact.tgz'}]},sha),/filename/);
});
test('replay validates the complete package set before changing any manifest',()=>{
  const directory = mkdtempSync(join(tmpdir(),'mdi-release-test-'));
  try {
    const manifestPath=join(directory,'package.json');
    const baseline={name:artifact.name,version:'2.0.9'};
    writeFileSync(manifestPath,JSON.stringify(baseline));
    assert.throws(()=>applyReleaseVersions({...manifest,artifacts:[artifact,{...artifact,name:'unknown'}]},[{manifestPath,manifest:baseline}]),/Unknown/);
    assert.equal(JSON.parse(readFileSync(manifestPath)).version,'2.0.9');
    applyReleaseVersions(manifest,[{manifestPath,manifest:baseline}]);
    applyReleaseVersions(manifest,[{manifestPath,manifest:baseline}]);
    assert.equal(JSON.parse(readFileSync(manifestPath)).version,'2.1.0');
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
