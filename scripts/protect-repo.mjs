// Sets the GitHub security settings for the repo in site.config.json, with the GitHub CLI.
// Run it only after the repo is public:  npm run protect-repo
// It turns on secret scanning, push protection, Dependabot alerts and Dependabot security
// updates, and adds a ruleset that protects main. It prints no secret.
import { execFileSync } from 'node:child_process';
import { loadConfig, parseGitHubRepo } from './site.mjs';

const repo = parseGitHubRepo(loadConfig().repo);
const gh = (args, input) => execFileSync('gh', args, { input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'inherit'] }).toString();

const visibility = JSON.parse(gh(['repo', 'view', repo, '--json', 'visibility'])).visibility;
if (visibility !== 'PUBLIC') {
  console.error(`protect-repo: ${repo} is ${visibility.toLowerCase()}. Make it public first, because these settings are free only on public repos.`);
  process.exit(1);
}

gh(['api', '-X', 'PATCH', `repos/${repo}`, '--input', '-'], JSON.stringify({
  security_and_analysis: {
    secret_scanning: { status: 'enabled' },
    secret_scanning_push_protection: { status: 'enabled' },
  },
}));
console.log('protect-repo: secret scanning and push protection are on.');

gh(['api', '-X', 'PUT', `repos/${repo}/vulnerability-alerts`]);
gh(['api', '-X', 'PUT', `repos/${repo}/automated-security-fixes`]);
console.log('protect-repo: Dependabot alerts and security updates are on.');

const name = 'Protect main';
const existing = JSON.parse(gh(['api', `repos/${repo}/rulesets`]));
const ruleset = {
  name,
  target: 'branch',
  enforcement: 'active',
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  bypass_actors: [],
  rules: [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    {
      type: 'pull_request',
      parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
      },
    },
    {
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: false,
        required_status_checks: [{ context: 'Build, test and scan' }],
      },
    },
  ],
};
const found = existing.find((r) => r.name === name);
if (found) gh(['api', '-X', 'PUT', `repos/${repo}/rulesets/${found.id}`, '--input', '-'], JSON.stringify(ruleset));
else gh(['api', '-X', 'POST', `repos/${repo}/rulesets`, '--input', '-'], JSON.stringify(ruleset));
console.log('protect-repo: main is protected. Changes need a pull request, and CI must pass.');
