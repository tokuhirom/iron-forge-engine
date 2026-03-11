import { defineConfig } from "vite";
import { execSync } from "child_process";

const commitHash = execSync("git rev-parse --short HEAD").toString().trim();
const buildDate = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
});
