import path from "path";

/**
 * Map of file extensions to language names.
 */
const EXTENSION_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",

  // Web
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "SASS",
  ".less": "LESS",
  ".svg": "SVG",

  // Data / Config
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".xml": "XML",
  ".csv": "CSV",
  ".env": "Env",
  ".ini": "INI",

  // Systems / Compiled
  ".rs": "Rust",
  ".go": "Go",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".hpp": "C++",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".cs": "C#",

  // Scripting
  ".py": "Python",
  ".rb": "Ruby",
  ".php": "PHP",
  ".pl": "Perl",
  ".lua": "Lua",
  ".r": "R",
  ".R": "R",

  // Shell
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".fish": "Shell",

  // Documentation
  ".md": "Markdown",
  ".mdx": "MDX",
  ".rst": "reStructuredText",
  ".txt": "Text",

  // DevOps / Infra
  ".tf": "Terraform",
  ".hcl": "HCL",
  ".dockerfile": "Docker",

  // Database
  ".sql": "SQL",
  ".prisma": "Prisma",
  ".graphql": "GraphQL",
  ".gql": "GraphQL",

  // Other
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".astro": "Astro",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".erl": "Erlang",
  ".zig": "Zig",
  ".nim": "Nim",
  ".dart": "Dart",
  ".proto": "Protobuf",
};

/**
 * Detect programming language from a file path based on its extension.
 * Returns "Unknown" if the extension is not recognized.
 */
export function detectLanguage(filePath: string): string {
  if (!filePath) return "Unknown";

  // Handle special filenames
  const basename = path.basename(filePath).toLowerCase();
  if (basename === "dockerfile" || basename.startsWith("dockerfile.")) {
    return "Docker";
  }
  if (basename === "makefile" || basename === "gnumakefile") {
    return "Makefile";
  }
  if (basename === "rakefile" || basename === "gemfile") {
    return "Ruby";
  }
  if (basename === "cargo.toml" || basename === "cargo.lock") {
    return "Rust";
  }

  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] || "Unknown";
}

export { EXTENSION_MAP };
