import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Read the screening guidance from the project root
// Try multiple paths to handle both development and production
function loadGuidance(): string {
  const paths = [
    // Development path (from src/)
    join(process.cwd(), "SCREENING_GUIDANCE.txt"),
    // Production path (from dist/)
    join(process.cwd(), "../SCREENING_GUIDANCE.txt"),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      return readFileSync(path, "utf-8");
    }
  }

  throw new Error(
    `SCREENING_GUIDANCE.txt not found. Tried: ${paths.join(", ")}`
  );
}

export const SCREENING_GUIDANCE = loadGuidance();
