import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js") && !specifier.endsWith(".mjs")) {
    if (context.parentURL) {
      const parentPath = fileURLToPath(context.parentURL);
      const dir = parentPath.replace(/[/\\][^/\\]+$/, "");
      const sep = dir.includes("\\") ? "\\" : "/";
      const candidate = dir + sep + specifier.replace(/^\.\//, "").replace(/\//g, sep) + ".ts";
      if (existsSync(candidate)) {
        return nextResolve(specifier + ".ts", context);
      }
    }
  }
  return nextResolve(specifier, context);
}
