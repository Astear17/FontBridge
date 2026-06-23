"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { FONT_REGISTRY, WEIGHT_LABELS } = require("../font-registry.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const CHECK_ONLY = process.argv.includes("--check");
const BUNDLED_FONTS = FONT_REGISTRY.filter((entry) => entry.source === "bundled");
const SYSTEM_ONLY_FONTS = FONT_REGISTRY.filter((entry) => entry.status === "system-only");
const LICENSE_SKIPPED_FONTS = FONT_REGISTRY.filter(
  (entry) => entry.status === "license-review-skipped"
);

const packageScanCache = new Map();

main().catch((error) => {
  console.error("[FontBridge] prepare-fonts failed.");
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  ensureBundledDirectories();

  const found = [];
  const missing = [];

  for (const entry of BUNDLED_FONTS) {
    const result = CHECK_ONLY ? checkEntry(entry) : prepareEntry(entry);
    if (result.ok) {
      found.push(result);
    } else {
      missing.push(result);
    }
  }

  printReport({ found, missing });
  process.exitCode = missing.length ? 1 : 0;
}

function ensureBundledDirectories() {
  for (const entry of BUNDLED_FONTS) {
    const targetDir = path.dirname(resolveResourcePath(Object.values(entry.weights)[0]));
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

function checkEntry(entry) {
  const missingTargets = getMissingTargetFiles(entry);
  if (!missingTargets.length) {
    return {
      ok: true,
      name: entry.name,
      detail: "All required bundled files are present."
    };
  }

  return {
    ok: false,
    name: entry.name,
    detail: `Missing ${missingTargets.length} file(s): ${missingTargets.join(", ")}`
  };
}

function prepareEntry(entry) {
  const missingTargets = getMissingTargetFiles(entry);
  if (!missingTargets.length) {
    return {
      ok: true,
      name: entry.name,
      detail: "All required bundled files are already present."
    };
  }

  const packageDir = resolvePackageDirectory(entry.packageName);
  if (!packageDir) {
    return {
      ok: false,
      name: entry.name,
      detail: `Package ${entry.packageName} is not installed and ${missingTargets.length} target file(s) are still missing.`
    };
  }

  const candidates = scanPackageFonts(packageDir);
  const weightNotes = [];

  for (const [weightKey, resourcePath] of Object.entries(entry.weights)) {
    const targetPath = resolveResourcePath(resourcePath);
    if (fs.existsSync(targetPath)) {
      continue;
    }

    const desiredWeight = Number(weightKey);
    const candidate = findBestCandidate(candidates, desiredWeight);
    if (!candidate) {
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(candidate.path, targetPath);

    if (candidate.weight !== desiredWeight) {
      weightNotes.push(
        `${desiredWeight} used nearest available ${candidate.weight} from ${path.basename(candidate.path)}`
      );
    }
  }

  const remainingMissing = getMissingTargetFiles(entry);
  if (remainingMissing.length) {
    return {
      ok: false,
      name: entry.name,
      detail: `Still missing ${remainingMissing.length} file(s): ${remainingMissing.join(", ")}`
    };
  }

  return {
    ok: true,
    name: entry.name,
    detail: weightNotes.length
      ? `Prepared with fallbacks: ${weightNotes.join("; ")}`
      : "Prepared from local package files."
  };
}

function getMissingTargetFiles(entry) {
  return Object.values(entry.weights)
    .map((resourcePath) => resolveResourcePath(resourcePath))
    .filter((targetPath) => !fs.existsSync(targetPath))
    .map((targetPath) => path.relative(ROOT_DIR, targetPath));
}

function resolveResourcePath(resourcePath) {
  return path.join(ROOT_DIR, String(resourcePath).replace(/\//g, path.sep));
}

function resolvePackageDirectory(packageName) {
  if (!packageName) {
    return null;
  }

  const segments = packageName.split("/");
  const packageDir = path.join(ROOT_DIR, "node_modules", ...segments);
  return fs.existsSync(packageDir) ? packageDir : null;
}

function scanPackageFonts(packageDir) {
  if (packageScanCache.has(packageDir)) {
    return packageScanCache.get(packageDir);
  }

  const files = walk(packageDir).filter((filePath) => filePath.toLowerCase().endsWith(".woff2"));
  const candidates = files
    .map((filePath) => createCandidate(filePath))
    .filter(Boolean);

  packageScanCache.set(packageDir, candidates);
  return candidates;
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function createCandidate(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  const weightMatch = basename.match(/(?:^|[^0-9])(100|200|300|400|500|600|700|800|900)(?:[^0-9]|$)/);
  const weight = weightMatch ? Number(weightMatch[1]) : basename.includes("variable") ? 400 : null;

  if (weight === null) {
    return null;
  }

  return {
    path: filePath,
    basename,
    weight,
    italic: basename.includes("italic"),
    normal: basename.includes("normal") || !basename.includes("italic"),
    latin: basename.includes("latin"),
    latinExt: basename.includes("latin-ext"),
    variable: basename.includes("variable")
  };
}

function findBestCandidate(candidates, desiredWeight) {
  let best = null;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    if (candidate.italic) {
      continue;
    }

    let score = 0;
    score += candidate.normal ? 120 : 0;
    score += candidate.latin ? 80 : 0;
    score += candidate.latinExt ? 60 : 0;
    score += candidate.variable ? -25 : 0;
    score += candidate.weight === desiredWeight ? 500 : Math.max(0, 220 - Math.abs(candidate.weight - desiredWeight));

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function printReport(summary) {
  const title = CHECK_ONLY ? "Font check report" : "Font preparation report";
  console.log(`\nFontBridge ${title}`);
  console.log("=".repeat(`FontBridge ${title}`.length));

  console.log(`\nBundled candidates: ${BUNDLED_FONTS.length}`);
  console.log(`Found: ${summary.found.length}`);
  console.log(`Missing: ${summary.missing.length}`);
  console.log(`System-only: ${SYSTEM_ONLY_FONTS.length}`);
  console.log(`License-review skipped: ${LICENSE_SKIPPED_FONTS.length}`);

  if (summary.found.length) {
    console.log("\nFound");
    console.log("-----");
    for (const result of summary.found) {
      console.log(`- ${result.name}: ${result.detail}`);
    }
  }

  if (summary.missing.length) {
    console.log("\nMissing");
    console.log("-------");
    for (const result of summary.missing) {
      console.log(`- ${result.name}: ${result.detail}`);
    }
  }

  console.log("\nSystem-only");
  console.log("-----------");
  for (const entry of SYSTEM_ONLY_FONTS) {
    console.log(`- ${entry.name}`);
  }

  console.log("\nSkipped due to license review");
  console.log("----------------------------");
  for (const entry of LICENSE_SKIPPED_FONTS) {
    console.log(`- ${entry.name}: ${entry.note}`);
  }

  console.log("\nExpected weights");
  console.log("----------------");
  for (const [weight, label] of Object.entries(WEIGHT_LABELS)) {
    console.log(`- ${weight}: ${label}`);
  }

  if (summary.missing.length) {
    console.log(
      "\nTip: run `npm install` first so the local @fontsource packages from package.json are available, then run `npm run prepare-fonts`."
    );
  }
}
