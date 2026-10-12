#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

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
  !files.has(`package/${target.slice(2)}`))) {
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

const assertSameArtifact = (integrity) => {
  if (integrity !== expectedIntegrity) {
    throw new Error(
      `${packageSpec} already exists at ${registry} with a different integrity`,
    );
  }
};

const existingIntegrity = await readPublishedIntegrity();
if (existingIntegrity) {
  assertSameArtifact(existingIntegrity);
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
    assertSameArtifact(integrity);
    console.log(`verified ${packageSpec} at ${registry}`);
    process.exit(0);
  }
  await delay(5_000);
}

throw new Error(`${packageSpec} was not visible at ${registry} after publishing`);
