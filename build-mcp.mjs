import { build } from "esbuild";

const dbRewritePlugin = {
  name: "db-rewrite",
  setup(build) {
    // Intercept imports of the server db module and mark as external
    // with a path that works from dist/mcp/ at runtime
    build.onResolve({ filter: /\/server\/db\.js$/ }, () => ({
      path: "../server/db.js",
      external: true,
    }));
  },
};

await build({
  entryPoints: ["src/mcp/setup.ts"],
  bundle: true,
  platform: "node",
  outfile: "dist/mcp/setup.js",
  external: ["better-sqlite3"],
  plugins: [dbRewritePlugin],
});
