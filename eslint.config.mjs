import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The app is still on React 18 and uses client hydration plus callback refs
    // for the AI SDK/ASR lifecycle. Keep the core Hooks rules while opting out
    // of React Compiler rules until the React 19 migration is scheduled.
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".next.bak-*/**",
    ".node-runtime/**",
    "fc-package/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
