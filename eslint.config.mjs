import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";
const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) });
export default [...compat.extends("next/core-web-vitals"), { ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**"] }];
