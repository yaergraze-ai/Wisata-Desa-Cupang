import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".agent/**",
      ".agents/**",
      "referensi/**",
      "public/maps/**",
      "public/maplibre-gl-worker.mjs",
      "scratch/**",
      "scripts/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": "allow-with-description",
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 12,
        },
      ],
    },
  },
];

export default eslintConfig;
