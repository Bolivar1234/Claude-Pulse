/**
 * Framework/tool detection from bash commands.
 * Returns an array of detected framework identifiers.
 */

interface FrameworkPattern {
  /** Regex to match against the command string */
  pattern: RegExp;
  /** Framework identifier */
  framework: string;
}

const FRAMEWORK_PATTERNS: FrameworkPattern[] = [
  // Node.js ecosystem
  { pattern: /\bnpm\b/, framework: "npm/node" },
  { pattern: /\bnpx\b/, framework: "npx/node" },
  { pattern: /\byarn\b/, framework: "yarn/node" },
  { pattern: /\bpnpm\b/, framework: "pnpm/node" },
  { pattern: /\bbun\b/, framework: "bun" },
  { pattern: /\bnode\b/, framework: "node" },
  { pattern: /\bdeno\b/, framework: "deno" },

  // Version control
  { pattern: /\bgit\b/, framework: "git" },

  // Containers
  { pattern: /\bdocker-compose\b/, framework: "docker-compose" },
  { pattern: /\bdocker\b/, framework: "docker" },
  { pattern: /\bpodman\b/, framework: "podman" },

  // Python
  { pattern: /\bpython3?\b/, framework: "python" },
  { pattern: /\bpip3?\b/, framework: "pip/python" },
  { pattern: /\bpipenv\b/, framework: "pipenv/python" },
  { pattern: /\bpoetry\b/, framework: "poetry/python" },
  { pattern: /\bpytest\b/, framework: "pytest/python" },
  { pattern: /\buv\b/, framework: "uv/python" },
  { pattern: /\buvx\b/, framework: "uvx/python" },
  { pattern: /\bconda\b/, framework: "conda/python" },

  // Rust
  { pattern: /\bcargo\b/, framework: "cargo/rust" },
  { pattern: /\brustc\b/, framework: "rustc/rust" },
  { pattern: /\brustup\b/, framework: "rustup/rust" },

  // Go
  { pattern: /\bgo\s+(build|run|test|mod|get|install|fmt|vet)\b/, framework: "go" },

  // Ruby
  { pattern: /\bruby\b/, framework: "ruby" },
  { pattern: /\brails\b/, framework: "rails/ruby" },
  { pattern: /\bbundle\b/, framework: "bundler/ruby" },
  { pattern: /\bgem\b/, framework: "gem/ruby" },
  { pattern: /\brake\b/, framework: "rake/ruby" },

  // Kubernetes
  { pattern: /\bkubectl\b/, framework: "kubectl/k8s" },
  { pattern: /\bhelm\b/, framework: "helm/k8s" },
  { pattern: /\bminikube\b/, framework: "minikube/k8s" },
  { pattern: /\bk9s\b/, framework: "k9s/k8s" },

  // Infrastructure as Code
  { pattern: /\bterraform\b/, framework: "terraform" },
  { pattern: /\bpulumi\b/, framework: "pulumi" },
  { pattern: /\bansible\b/, framework: "ansible" },

  // Cloud CLIs
  { pattern: /\baws\b/, framework: "aws" },
  { pattern: /\bgcloud\b/, framework: "gcloud" },
  { pattern: /\baz\b/, framework: "azure" },

  // HTTP tools
  { pattern: /\bcurl\b/, framework: "curl/http" },
  { pattern: /\bwget\b/, framework: "wget/http" },
  { pattern: /\bhttpie\b/, framework: "httpie/http" },

  // Databases
  { pattern: /\bpsql\b/, framework: "psql/postgres" },
  { pattern: /\bmysql\b/, framework: "mysql" },
  { pattern: /\bsqlite3\b/, framework: "sqlite" },
  { pattern: /\bredis-cli\b/, framework: "redis" },
  { pattern: /\bmongosh?\b/, framework: "mongo" },

  // Build tools
  { pattern: /\bmake\b/, framework: "make" },
  { pattern: /\bcmake\b/, framework: "cmake" },
  { pattern: /\bgradle\b/, framework: "gradle/java" },
  { pattern: /\bmaven\b|\bmvn\b/, framework: "maven/java" },

  // Deployment platforms
  { pattern: /\bfly\b/, framework: "fly.io" },
  { pattern: /\bvercel\b/, framework: "vercel" },
  { pattern: /\bnetlify\b/, framework: "netlify" },
  { pattern: /\bheroku\b/, framework: "heroku" },
  { pattern: /\brailway\b/, framework: "railway" },

  // Lazy-fetch
  { pattern: /\blazy\b/, framework: "lazy-fetch" },

  // Testing
  { pattern: /\bjest\b/, framework: "jest/node" },
  { pattern: /\bvitest\b/, framework: "vitest/node" },
  { pattern: /\bplaywright\b/, framework: "playwright" },
  { pattern: /\bcypress\b/, framework: "cypress" },
];

/**
 * Detect frameworks/tools used in a bash command.
 * Returns an array of framework identifiers (e.g., ["npm/node", "git"]).
 */
export function detectFrameworks(command: string): string[] {
  if (!command) return [];

  const detected: string[] = [];
  for (const { pattern, framework } of FRAMEWORK_PATTERNS) {
    if (pattern.test(command)) {
      detected.push(framework);
    }
  }
  return detected;
}

export { FRAMEWORK_PATTERNS };
