#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { matchesGlob } from "node:path";

const execFileAsync = promisify(execFile);
const [artifact, registry, manifestPath] = process.argv.slice(2);

if (!artifact || !registry) {
  throw new Error("Usage: publish-registry.mjs <package.tgz> <registry-url> [package.json]");
}

const manifest = JSON.parse(
  await readFile(manifestPath ?? new URL("../package.json", import.meta.url), "utf8"),
);
const registryUrl = new URL(registry);
if (!["http:", "https:"].includes(registryUrl.protocol)) {
  throw new Error("Registry must be an HTTP(S) URL");
}
const { stdout: packedJson } = await execFileAsync("tar", [
  "-xOzf", artifact, "package/package.json",
]);
const packedManifest = JSON.parse(packedJson);
if (!manifest.name || !manifest.version || packedManifest.private === true ||
    packedManifest.name !== manifest.name || packedManifest.version !== manifest.version) {
  throw new Error("Artifact name/version must match the expected non-private package");
}
const { stdout: packedFiles } = await execFileAsync("tar", ["-tzf", artifact]);
const files = new Set(packedFiles.trim().split("\n").filter((file) => !file.endsWith("/")));
const targetsOf = (entry) => {
  if (typeof entry === "string") return [entry];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Artifact must have valid export targets");
  }
  return Object.values(entry).flatMap(targetsOf);
};
const targets = targetsOf(packedManifest.exports);
if (targets.length === 0 || targets.some((target) =>
  !target.startsWith("./") || target.split("/").includes("..") ||
  !(target.includes('*')
    ? [...files].some((file) => matchesGlob(file, `package/${target.slice(2)}`))
    : files.has(`package/${target.slice(2)}`)))) {
  throw new Error("Artifact has missing or invalid export targets");
}
const packageSpec = `${manifest.name}@${manifest.version}`;
const expectedIntegrity = `sha512-${createHash("sha512")
  .update(await readFile(artifact))
  .digest("base64")}`;

const npm = (args) =>
  execFileAsync("npm", args, {
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
  });

const npmPack = (args) =>
  execFileAsync("npm", args, {
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
    timeout: 120_000,
  });

const readPublishedIntegrity = async () => {
  try {
    const { stdout } = await npm([
      "view",
      packageSpec,
      "dist.integrity",
      "--json",
      `--registry=${registry}`,
    ]);
    const integrity = JSON.parse(stdout.trim());
    return typeof integrity === "string" ? integrity : undefined;
  } catch (error) {
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    if (/\bE404\b|404 Not Found/u.test(output)) return undefined;
    throw new Error(`Could not inspect ${packageSpec} at ${registry}:\n${output}`);
  }
};

const MAX_DIAGNOSTIC_MEMBERS = 20;
const summarize = (label, members) =>
  members.length === 0
    ? undefined
    : `${label}: ${members.slice(0, MAX_DIAGNOSTIC_MEMBERS).join(', ')}${members.length > MAX_DIAGNOSTIC_MEMBERS ? `, and ${members.length - MAX_DIAGNOSTIC_MEMBERS} more` : ''}`;

const downloadPublished = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'jfrader-published-'));
  try {
    await npmPack([
      'pack',
      packageSpec,
      '--ignore-scripts',
      '--pack-destination',
      dir,
      `--registry=${registry}`,
    ]);
    const tarballs = (await readdir(dir)).filter((name) => name.endsWith('.tgz'));
    if (tarballs.length !== 1) throw new Error(`npm pack produced ${tarballs.length} tarballs`);
    return { dir, tarball: path.join(dir, tarballs[0]) };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
};

const archiveMembers = async (tarball) => {
  const { stdout } = await execFileAsync('tar', ['-tzf', tarball], { maxBuffer: 16 * 1024 * 1024 });
  const members = stdout.split('\n').map((line) => line.trim()).filter((line) => line && !line.endsWith('/'));
  for (const member of members) {
    if (member.startsWith('/') || member.split('/').includes('..')) {
      throw new Error(`archive member ${JSON.stringify(member)} is not a safe relative path`);
    }
  }
  return members;
};

const fileDigest = async (dir, relative) =>
  createHash('sha256').update(await readFile(path.join(dir, relative))).digest('hex');

const compareArchives = async (local, published) => {
  const [localMembers, publishedMembers] = await Promise.all([archiveMembers(local), archiveMembers(published)]);
  const [localDir, publishedDir] = await Promise.all([
    mkdtemp(path.join(tmpdir(), 'jfrader-local-')),
    mkdtemp(path.join(tmpdir(), 'jfrader-published-compare-')),
  ]);
  try {
    await Promise.all([
      execFileAsync('tar', ['-xzf', local, '-C', localDir], { maxBuffer: 16 * 1024 * 1024 }),
      execFileAsync('tar', ['-xzf', published, '-C', publishedDir], { maxBuffer: 16 * 1024 * 1024 }),
    ]);
    const localSet = new Set(localMembers);
    const publishedSet = new Set(publishedMembers);
    const added = publishedMembers.filter((member) => !localSet.has(member));
    const removed = localMembers.filter((member) => !publishedSet.has(member));
    const changed = [];
    for (const member of localMembers) {
      if (!publishedSet.has(member)) continue;
      const [left, right] = await Promise.all([
        fileDigest(localDir, member),
        fileDigest(publishedDir, member),
      ]);
      if (left !== right) changed.push(member);
    }
    const detail = [
      summarize('added', added),
      summarize('removed', removed),
      summarize('changed', changed),
    ].filter(Boolean);
    return detail.length > 0
      ? detail.join('\n')
      : 'archive members are identical; the tarball bytes differ (metadata or compression)';
  } finally {
    await Promise.all([
      rm(localDir, { recursive: true, force: true }),
      rm(publishedDir, { recursive: true, force: true }),
    ]);
  }
};

const assertSameArtifact = async (integrity) => {
  if (integrity === expectedIntegrity) return;
  let detail = '';
  try {
    const published = await downloadPublished();
    try {
      detail = await compareArchives(artifact, published.tarball);
    } finally {
      await rm(published.dir, { recursive: true, force: true });
    }
  } catch (error) {
    detail = `member comparison unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
  throw new Error(
    `${packageSpec} already exists at ${registry} with a different integrity\n${detail}`,
  );
};

const existingIntegrity = await readPublishedIntegrity();
if (existingIntegrity) {
  await assertSameArtifact(existingIntegrity);
  console.log(`${packageSpec} already has the verified artifact at ${registry}`);
  process.exit(0);
}

const { stdout, stderr } = await npm([
  "publish",
  artifact,
  "--access=public",
  "--ignore-scripts",
  `--registry=${registry}`,
]);
process.stdout.write(stdout);
process.stderr.write(stderr);

for (let attempt = 0; attempt < 90; attempt += 1) {
  const integrity = await readPublishedIntegrity();
  if (integrity) {
    await assertSameArtifact(integrity);
    console.log(`verified ${packageSpec} at ${registry}`);
    process.exit(0);
  }
  await delay(5_000);
}

throw new Error(`${packageSpec} was not visible at ${registry} after publishing`);
