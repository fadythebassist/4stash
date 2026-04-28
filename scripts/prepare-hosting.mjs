import { copyFile, rm } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const indexPath = join(distDir, "index.html");
const spaPath = join(distDir, "spa.html");

await copyFile(indexPath, spaPath);
await rm(indexPath);
