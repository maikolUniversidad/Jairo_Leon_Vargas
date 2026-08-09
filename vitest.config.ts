import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reportsDirectory: "docs/qa/coverage",
      include: ["src/lib/**/*.ts", "src/types/roles.ts"],
      // Módulos que solo envuelven llamadas de red o SDKs externos: no aportan
      // nada medirlos aquí, se validan en el QA de integración.
      exclude: [
        "src/lib/supabase/**",
        "src/lib/google-drive.ts",
        "src/lib/higgsfield.ts",
        "src/lib/avatars/**",
        "src/lib/ia/provider.ts",
        "src/lib/ia/embeddings.ts",
        "src/lib/monitoring/collectors.ts",
        "src/lib/search.ts",
        "src/lib/ai.ts",
      ],
    },
  },
});
