/* eslint-disable no-console */
// Usage:
//   node shard-tests.mjs [testFilter] [testRootDir]
//   node shard-tests.mjs [testFilter] [platform] [testRootDir] [shardIndex] [shardTotal]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

// Cross-platform deterministic string comparison
function compareStrings(a, b) {
  const normalizedA = path.normalize(a);
  const normalizedB = path.normalize(b);

  return normalizedA.localeCompare(normalizedB, "en", {
    sensitivity: "case",
    numeric: true,
    ignorePunctuation: false,
  });
}

export function findTestFiles(dir) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return compareStrings(a.name, b.name);
    });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(findTestFiles(fullPath));
      } else if (entry.name.endsWith(".spec.ts") && !entry.name.endsWith(".skip.spec.ts")) {
        results.push(fullPath);
      }
    }
  } catch (e) {
    if (e.code === "ENOENT") return [];
    console.error("[shard-tests] Error reading directory:", dir, e);
    throw new Error(`Failed to read directory ${dir}: ${e.message}`);
  }
  return results.sort(compareStrings);
}

// Extract the tags a spec *declares*, e.g. "@smoke", "@NanoSP", "@family-evm".
// Detox/jest-allure2 tags are always authored as quoted string literals starting
// with "@" — via `$Tag("@x")`, `tags: ["@x", ...]`, or arrays passed to helpers
// like `runSwapTest(..., ["@ethereum", ...])`. Matching only these (instead of the
// whole file text) prevents a spec from being selected just because the filter word
// appears in a comment, a describe/it title, or a page-object method name
// (e.g. `pressQuickActionSwapButton`).
function extractDeclaredTags(fileContent) {
  const literals = fileContent.match(/['"`]@[\w-]+['"`]/g) ?? [];
  // Strip the surrounding quotes/backticks, keep the leading "@".
  return literals.map(literal => literal.slice(1, -1));
}

export function filterTestFiles(files, testFilter) {
  if (!testFilter) return files;
  const filters = testFilter.trim().split(/\s+/).filter(Boolean);
  const filterRegex = new RegExp(filters.join("|"), "i");

  const filtered = files.filter(filePath => {
    // 1. Path match: lets you target a single spec file or a whole folder by
    //    name/path (e.g. "swapETH_BTC.spec.ts", "specs/swap", "wallet40Q2/portfolio").
    if (filterRegex.test(filePath)) return true;
    // 2. Tag match: select a spec only when one of its *declared tags* matches the
    //    filter (e.g. "@smoke", "@family-evm"). This mirrors the desktop behaviour
    //    (Playwright --grep over titles + tags) at the file-selection granularity
    //    Detox requires, without the false positives of a raw file-content scan.
    try {
      const tags = extractDeclaredTags(fs.readFileSync(filePath, "utf8"));
      return tags.some(tag => filterRegex.test(tag));
    } catch {
      return false;
    }
  });

  return filtered.sort(compareStrings);
}

function loadTimingData(platform, testRootDir) {
  try {
    const timingFile = path.join(testRootDir, "artifacts", `e2e-test-results-${platform}.json`);
    if (fs.existsSync(timingFile)) {
      const timingData = JSON.parse(fs.readFileSync(timingFile, "utf8"));
      console.error(`[shard-tests] Loaded timing data from ${timingFile}`);

      // Convert Jest test results array to object format expected by the script
      if (timingData.testResults && Array.isArray(timingData.testResults)) {
        const convertedTestResults = {};
        for (const testResult of timingData.testResults) {
          if (testResult.name) {
            // Extract filename from the full path
            const fileName = path.basename(testResult.name, ".spec.ts");
            convertedTestResults[fileName] = {
              duration:
                testResult.endTime && testResult.startTime
                  ? testResult.endTime - testResult.startTime
                  : 0,
            };
          }
        }
        return { ...timingData, testResults: convertedTestResults };
      }

      return timingData;
    }
  } catch (e) {
    console.error(`[shard-tests] Error loading timing data:`, e);
    throw new Error(`Failed to load timing data: ${e.message}`);
  }
  return {};
}

function distributeFilesByTiming(files, timingData, shardIndex, shardTotal) {
  if (!timingData.testResults || Object.keys(timingData.testResults).length === 0) {
    if (shardTotal <= 0) return [];
    // Spread tests across shards when timing is unavailable.
    return files.filter((_, i) => i % shardTotal === shardIndex - 1);
  }

  // Sort files by estimated duration (from timing data)
  const filesWithTiming = files.map(file => {
    const fileName = path.basename(file, ".spec.ts");
    const timing = timingData.testResults[fileName] || { duration: 0 };
    return { file, duration: timing.duration || 0 };
  });

  // Sort by duration (longest first for better load balancing)
  filesWithTiming.sort((a, b) => {
    if (b.duration !== a.duration) {
      return b.duration - a.duration;
    }
    // When durations are equal, sort by file path
    return compareStrings(a.file, b.file);
  });

  // Separate tests with actual timing from tests with 0ms duration
  const testsWithTiming = filesWithTiming.filter(f => f.duration > 0);
  const testsWithZeroTiming = filesWithTiming.filter(f => f.duration === 0);

  // Distribute files across shards using greedy approach for tests with actual timing
  const shards = Array.from({ length: shardTotal }, () => ({ files: [], totalDuration: 0 }));

  // First, distribute tests with actual timing using greedy approach
  for (const { file, duration } of testsWithTiming) {
    // Find shard with minimum total time
    // When multiple shards have the same total time, prefer the one with lower index for determinism
    let minShardIndex = 0;
    let minTotalTime = Infinity;

    for (let i = 0; i < shardTotal; i++) {
      if (shards[i].totalDuration < minTotalTime) {
        minTotalTime = shards[i].totalDuration;
        minShardIndex = i;
      }
    }

    // Add file to the shard with minimum total time
    shards[minShardIndex].files.push(file);
    shards[minShardIndex].totalDuration += duration;
  }

  // Then, distribute tests with 0ms duration using round-robin to ensure even distribution
  for (let i = 0; i < testsWithZeroTiming.length; i++) {
    const shardToUse = i % shardTotal;
    shards[shardToUse].files.push(testsWithZeroTiming[i].file);
  }

  return shards[shardIndex - 1]?.files || [];
}

/**
 * Main entry point that:
 * 1. Gets parameters from command line args
 * 2. Finds all test files in the directory
 * 3. Applies any filters
 * 4. If sharding parameters provided, distributes files by timing
 * 5. Outputs the final list of files as a space-separated string
 */
export function main() {
  const args = process.argv.slice(2);

  if (args.length >= 4) {
    const [testFilter, platform, testRootDir, shardIndex, shardTotal] = args;

    const files = findTestFiles(testRootDir);
    const filteredFiles = filterTestFiles(files, testFilter);

    const timingData = loadTimingData(platform, testRootDir);

    const shardFiles = distributeFilesByTiming(
      filteredFiles,
      timingData,
      parseInt(shardIndex),
      parseInt(shardTotal),
    );

    console.log(shardFiles.join(" "));
  } else {
    const [testFilter, testRootDir] = args;

    const files = findTestFiles(testRootDir || baseDir);
    const filteredFiles = filterTestFiles(files, testFilter || "");

    console.log(filteredFiles.join(" "));
  }
}

// Only run when invoked directly (e.g. `node shard-tests.mjs ...`), so the module
// can be imported by unit tests without executing.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
