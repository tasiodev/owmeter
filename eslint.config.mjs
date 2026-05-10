import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
  {
    rules: {
      // Unused variables are errors, not warnings
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Enforce `import type` for type-only imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // No `any` type
      "@typescript-eslint/no-explicit-any": "error",
      // No require() in TypeScript files
      "@typescript-eslint/no-require-imports": "error",
      // No console.log in production code (warn/error are allowed)
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Consistent equality checks
      "eqeqeq": ["error", "always", { null: "ignore" }],
    },
  },
]);

export default eslintConfig;
