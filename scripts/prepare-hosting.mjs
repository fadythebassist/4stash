import { copyFile, rm } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
const indexPath = join(distDir, "index.html");
const appPath = join(distDir, "app.html");

await copyFile(indexPath, appPath);
await rm(indexPath);
