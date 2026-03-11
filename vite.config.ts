import { defineConfig } from "vite";
import { execSync } from "child_process";

const commitHash = execSync("git rev-parse --short HEAD").toString().trim();
const buildDate = new Date().toISOString().replace("T", " ").slice(0, 19);

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
