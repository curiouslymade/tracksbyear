// Runs after "npm install" or "npm ci". It turns on the git hooks in .githooks/ for this clone.
// It does nothing in CI or outside a git clone.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!process.env.CI && existsSync('.git')) {
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
    console.log('setup-hooks: the gitleaks pre-commit hook is on.');
  } catch {
    console.warn('setup-hooks: cannot set core.hooksPath. Run: git config core.hooksPath .githooks');
  }
}
