/**
 * Pre-crawls the launch brand set so the index and the /report statistic exist
 * before any traffic arrives. Run: npm run precrawl -- [file] [concurrency]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/db";
import { scanDomain } from "../src/lib/scan-service";

async function main() {
  const file = process.argv[2] ?? resolve(process.cwd(), "scripts/brands.txt");
  const concurrency = Number(process.argv[3] ?? 4);

  const domains = readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  console.log(`Scanning ${domains.length} domains with concurrency ${concurrency}`);
  const queue = [...domains];
  const scores: number[] = [];
  const failures: string[] = [];

  async function worker(id: number) {
    for (;;) {
      const domain = queue.shift();
      if (!domain) return;
      try {
        const { result } = await scanDomain(domain);
        scores.push(result.score);
        console.log(`[${id}] ${domain} ${result.score}/100 ${result.grade}`);
      } catch (error) {
        failures.push(domain);
        console.log(`[${id}] ${domain} FAILED: ${(error as Error).message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1)));

  const average = scores.length === 0 ? 0 : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  const failing = scores.filter((score) => score < 40).length;
  console.log("\n--- launch statistic ---");
  console.log(`scored: ${scores.length}, failed to scan: ${failures.length}`);
  console.log(`average score: ${average}/100`);
  console.log(`grade F (effectively closed to agents): ${scores.length ? Math.round((failing / scores.length) * 100) : 0}%`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
