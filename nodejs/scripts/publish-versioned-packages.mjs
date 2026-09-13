import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { registryArtifactMatches, verifyReleaseArtifacts, waitForRegistryArtifact, waitForRegistryArtifact } from './release-artifacts.mjs';

const root = resolve(process.env.RELEASE_SOURCE_DIR ?? resolve(import.meta.dirname, '../..'));
const directory = resolve(root,process.env.RELEASE_ARTIFACTS_DIR ?? 'output/npm-release');
const sourceSha = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const manifest = verifyReleaseArtifacts(JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')),directory,sourceSha);
const dryRun = process.argv.includes('--dry-run');
if (!dryRun && process.env.GITHUB_ACTIONS !== 'true') throw new Error('Production publication must run in GitHub Actions');

function registryIntegrity(artifact) {
  try {
    return JSON.parse(execFileSync('npm',['view',`${artifact.name}@${artifact.version}`,'dist.integrity','--json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  } catch (error) {
    let code;
    try { code = JSON.parse(String(error.stdout)).error?.code; } catch { /* fail closed on non-registry errors */ }
    if (code === 'E404') return undefined;
    throw new Error(`Unable to verify registry artifact ${artifact.name}@${artifact.version}`,{cause:error});
  }
}

// Validate every existing artifact before the first publication. Recovery may
// skip only byte-identical files; an occupied foreign version is a conflict.
const pending = manifest.artifacts.filter((artifact) => !registryArtifactMatches(artifact,registryIntegrity(artifact)));
if (!dryRun) {
  for (const artifact of pending) {
    execFileSync('npm',['publish',join(directory,artifact.filename),'--access','public'],{cwd:root,stdio:'inherit'});
    await waitForRegistryArtifact(artifact, registryIntegrity);
  }
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT,`published=${pending.length > 0}\nready=${manifest.artifacts.length > 0}\npublishedPackages=${JSON.stringify(manifest.artifacts.map(({name,version})=>({name,version})))}\n`);
}
console.log(`${dryRun ? 'Would publish' : 'Published'} ${pending.length} artifacts; ${manifest.artifacts.length - pending.length} identical registry artifacts retained`);
