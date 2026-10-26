#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const reportReleaseVisibility = async () => {
  const registries = [
    ["https://registry.npmjs.org", process.env.NPMJS_OUTCOME],
    ["https://npm.pkg.github.com", process.env.GITHUB_PACKAGES_OUTCOME],
  ];
  console.log(`Release visibility for ${process.env.GITHUB_REF_NAME}`);
  for (const [registry, outcome] of registries) {
    console.log(`\n${registry}: publish step ${outcome || "skipped"}`);
    if (!outcome || outcome === "skipped") continue;
    for (const dir of ["tokens", "styling", "icons", "ui"]) {
      let spec = dir;
      try {
        const { name, version } = JSON.parse(
          await readFile(`packages/${dir}/package.json`, "utf8"),
        );
        spec = `${name}@${version}`;
        const headers = registry === "https://npm.pkg.github.com"
          ? { authorization: `Bearer ${process.env.NODE_AUTH_TOKEN}` }
          : {};
        const response = await fetch(`${registry}/${encodeURIComponent(name)}`, {
          headers,
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const metadata = await response.json();
        const artifact = metadata.versions?.[version]?.dist?.tarball;
        console.log(`${spec}: ${artifact ? `visible at ${artifact}` : "not visible"}`);
      } catch (error) {
        console.log(`${spec}: visibility unknown (${error.message})`);
      }
    }
  }
};

await reportReleaseVisibility().catch((error) => {
  console.log(`Release visibility unknown (${error.message})`);
});
