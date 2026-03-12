#!/usr/bin/env tsx

import { loadEnvConfig } from "@next/env";
import {
  buildMathSearchExampleCache,
  getMathSearchExampleCacheFilePath,
} from "../lib/math-search/example-cache";

loadEnvConfig(process.cwd());

const examples = await buildMathSearchExampleCache();

console.log(
  `Wrote ${examples.length} cached math search examples to ${getMathSearchExampleCacheFilePath()}`
);
