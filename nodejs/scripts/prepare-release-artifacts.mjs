import { execFileSync } from 'node:child_process';
import { appendFileSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { packPublishablePackage } from './pack-publishable-package.mjs';
import { applyReleaseVersions, integrity, verifyReleaseArtifacts } from './release-artifacts.mjs';

const root = resolve(import.meta.dirname, '../..');
const directory = resolve(root, process.env.RELEASE_ARTIFACTS_DIR ?? 'output/npm-release');
const sourceSha = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const packages = globSync(join(root,'nodejs/packages/*/package.json')).map((manifestPath) => ({manifestPath,manifest:JSON.parse(readFileSync(manifestPath,'utf8'))}));
let manifest;
if (process.argv.includes('--reuse')) {
  manifest = verifyReleaseArtifacts(JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')), directory, sourceSha);
  const target = process.env.RELEASE_TARGET_VERSION;
  if (target && manifest.artifacts.some((artifact) => artifact.version !== target)) throw new Error('Requested version differs from the saved release plan');
  applyReleaseVersions(manifest, packages);
} else {
  const selected = JSON.parse(process.env.RELEASE_PACKAGES ?? '[]');
  const entries = selected.map(({name,version}) => {
    const entry = packages.find(({manifest}) => manifest.name === name && manifest.version === version && !manifest.private);
    if (!entry) throw new Error(`Manifest does not match the selected release: ${name}@${version}`);
    return entry;
  });
  mkdirSync(directory,{recursive:true});
  if (entries.length) execFileSync('pnpm',['run','build'],{cwd:root,stdio:'inherit'});
  manifest = {version:1,sourceSha,artifacts:[]};
  for (const entry of entries) {
    const file = packPublishablePackage({packageDirectory:dirname(entry.manifestPath),outputDirectory:directory,workspaceRoot:join(root,'nodejs')});
    manifest.artifacts.push({name:entry.manifest.name,version:entry.manifest.version,filename:basename(file),integrity:integrity(readFileSync(file))});
  }
  writeFileSync(join(directory,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
  verifyReleaseArtifacts(manifest,directory,sourceSha);
}
const selected = manifest.artifacts.map(({name,version}) => ({name,version}));
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,`publishedPackages=${JSON.stringify(selected)}\n`);
console.log(`${process.argv.includes('--reuse') ? 'Restored' : 'Prepared'} ${selected.length} immutable release artifacts for ${sourceSha}`);
