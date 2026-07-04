import fs from "fs";
import path from "path";
import { getHash } from "./utils.js";
import { generateStatsSvg } from "./generateStats.js";
import { generateStreakSvg } from "./generateStreak.js";
import { generateLanguagesSvg } from "./generateLanguages.js";
import { generateContributionsSvg } from "./generateContributions.js";
import { generateActivitySvg } from "./generateActivity.js";

const CACHE_FILE = path.join(process.cwd(), "cache", "analytics.json");
const ASSETS_DIR = path.join(process.cwd(), "assets");
const TZ_OFFSET = parseFloat(process.env.TIMEZONE_OFFSET || "5.5");

// Ensure Assets Directory Exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Lightweight XML syntax validation check using Tag Balance algorithm
function validateSvgSyntax(svgString: string): { valid: boolean; error?: string } {
  // Regex to match tag names, open/close markers, and self-closing trailing slashes
  const tagRegex = /<(\/?[a-zA-Z0-9:-]+)([^>]*?)(\/?)>/g;
  const stack: string[] = [];
  let match;

  while ((match = tagRegex.exec(svgString)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const isSelfClosing = match[3] === "/" || fullTag.endsWith("/>");

    if (tagName.startsWith("?xml") || tagName.startsWith("!--")) {
      // Ignore xml declaration and comments
      continue;
    }

    if (tagName.startsWith("/")) {
      // Close tag
      const closingName = tagName.slice(1);
      const lastOpen = stack.pop();
      if (lastOpen !== closingName) {
        return {
          valid: false,
          error: `Mismatched closing tag. Expected </${lastOpen}> but found </${closingName}>.`,
        };
      }
    } else if (!isSelfClosing) {
      // Open tag
      stack.push(tagName);
    }
  }

  if (stack.length > 0) {
    return {
      valid: false,
      error: `Unclosed tags remaining: ${stack.join(", ")}`,
    };
  }

  return { valid: true };
}

function validateSvgDimensions(svgString: string, expectedWidth: number, expectedHeight: number): { valid: boolean; error?: string } {
  const widthMatch = svgString.match(/width="(\d+)"/);
  const heightMatch = svgString.match(/height="(\d+)"/);

  if (!widthMatch || !heightMatch) {
    return { valid: false, error: "SVG is missing width or height attributes." };
  }

  const parsedWidth = parseInt(widthMatch[1], 10);
  const parsedHeight = parseInt(heightMatch[1], 10);

  if (parsedWidth !== expectedWidth || parsedHeight !== expectedHeight) {
    return {
      valid: false,
      error: `Dimension mismatch. Expected ${expectedWidth}x${expectedHeight}, got ${parsedWidth}x${parsedHeight}.`,
    };
  }

  return { valid: true };
}

interface GeneratorTask {
  name: string;
  filename: string;
  expectedWidth: number;
  expectedHeight: number;
  generateFn: (data: any) => string;
}

function run() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`Starting generator pipeline. Mode: ${isDryRun ? "DRY-RUN" : "PRODUCTION"}`);

  if (!fs.existsSync(CACHE_FILE)) {
    console.error(`Error: Analytics database not found at ${CACHE_FILE}. Please run harvest (npm run fetch) first.`);
    process.exit(1);
  }

  let dbData: any;
  try {
    dbData = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } catch (err) {
    console.error("Error reading cache file:", err);
    process.exit(1);
  }

  const tasks: GeneratorTask[] = [
    {
      name: "GitHub Statistics Card",
      filename: "custom-stats.svg",
      expectedWidth: 495,
      expectedHeight: 195,
      generateFn: (data) => generateStatsSvg(data),
    },
    {
      name: "Streak Statistics Card",
      filename: "custom-streak.svg",
      expectedWidth: 495,
      expectedHeight: 195,
      generateFn: (data) => generateStreakSvg(data, TZ_OFFSET),
    },
    {
      name: "Top Languages Card",
      filename: "custom-languages.svg",
      expectedWidth: 495,
      expectedHeight: 195,
      generateFn: (data) => generateLanguagesSvg(data),
    },
    {
      name: "Contributions Grid Card",
      filename: "custom-contributions.svg",
      expectedWidth: 820,
      expectedHeight: 160,
      generateFn: (data) => generateContributionsSvg(data),
    },
    {
      name: "Productive Time Distribution Card",
      filename: "custom-activity.svg",
      expectedWidth: 495,
      expectedHeight: 195,
      generateFn: (data) => generateActivitySvg(data),
    },
  ];

  let successCount = 0;
  let errorCount = 0;

  tasks.forEach((task) => {
    console.log(`\nGenerating card: ${task.name} (${task.filename})...`);

    try {
      // 1. Generate SVG in-memory
      const svgContent = task.generateFn(dbData);

      // 2. Validate Syntax (Tag balance)
      const syntaxResult = validateSvgSyntax(svgContent);
      if (!syntaxResult.valid) {
        console.error(`❌ Syntax Validation Failed: ${syntaxResult.error}`);
        errorCount++;
        return;
      }

      // 3. Validate Dimensions
      const dimResult = validateSvgDimensions(svgContent, task.expectedWidth, task.expectedHeight);
      if (!dimResult.valid) {
        console.error(`❌ Dimension Validation Failed: ${dimResult.error}`);
        errorCount++;
        return;
      }

      // Validations succeeded
      console.log("✔ Validation passed: syntax is clean, dimensions match expected limits.");

      const targetPath = path.join(ASSETS_DIR, task.filename);
      const newHash = getHash(svgContent);

      // 4. Compare with existing file hash
      let hashesMatch = false;
      if (fs.existsSync(targetPath)) {
        const existingContent = fs.readFileSync(targetPath, "utf-8");
        const existingHash = getHash(existingContent);
        hashesMatch = (newHash === existingHash);
      }

      if (hashesMatch) {
        console.log(`ℹ Contents unchanged. Skipping writing to ${task.filename}`);
      } else {
        if (isDryRun) {
          console.log(`[DRY-RUN] Would write updated content to ${targetPath}`);
        } else {
          fs.writeFileSync(targetPath, svgContent, "utf-8");
          console.log(`💾 Successfully saved updated card: ${targetPath}`);
        }
      }

      successCount++;
    } catch (err) {
      console.error(`❌ Execution failed for task ${task.name}:`, err);
      errorCount++;
    }
  });

  console.log(`\nPipeline completed. Total Tasks: ${tasks.length}, Success: ${successCount}, Failures: ${errorCount}`);
  if (errorCount > 0) {
    process.exit(1);
  }
}

run();
