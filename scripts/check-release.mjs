import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const pkg = JSON.parse(read('../package.json'));
const lock = JSON.parse(read('../package-lock.json'));
const tauri = JSON.parse(read('../src-tauri/tauri.conf.json'));
const cargo = read('../src-tauri/Cargo.toml');
const cargoLock = read('../src-tauri/Cargo.lock');
const notes = read('../RELEASE_NOTES.md');
const version = pkg.version;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Expected a stable semver version, got ${version}`);
}

const cargoVersion = cargo.match(/^version = "([^"]+)"/m)?.[1];
const cargoLockVersion = cargoLock.match(/\[\[package\]\]\r?\nname = "mdpad"\r?\nversion = "([^"]+)"/)?.[1];
const versions = {
  'package-lock.json': lock.version,
  'package-lock.json (root)': lock.packages[''].version,
  'src-tauri/tauri.conf.json': tauri.version,
  'src-tauri/Cargo.toml': cargoVersion,
  'src-tauri/Cargo.lock': cargoLockVersion,
};

for (const [file, actual] of Object.entries(versions)) {
  if (actual !== version) throw new Error(`${file}: expected ${version}, got ${actual ?? 'missing'}`);
}

const noteLines = read('../RELEASE_NOTES.md').split(/\r?\n/);
if (noteLines[0] !== `# MDPad v${version}`) {
  throw new Error(`RELEASE_NOTES.md first line must be "# MDPad v${version}", got ${JSON.stringify(noteLines[0])}`);
}

const tag = process.argv[2] ?? (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined);
if (tag && tag !== `v${version}`) {
  throw new Error(`Tag ${tag} does not match v${version}`);
}

console.log(`Release metadata OK: v${version}${tag ? ` (${tag})` : ''}`);
