// ============================================
// MVT-2 / MVT-3 / MVT-4 — the standalone scripts in apps/api/scripts must
// take every credential from the environment, and must never carry one in
// source again.
//
// Why this exists: create-demo-users.mjs once held a live service_role JWT
// that shipped to a public repo (SEC-ROTATE-001). MVT-2/3 pin the fail-closed
// behaviour; MVT-4 is the regression guard that makes a one-time cleanup
// permanent — without it, a future paste re-opens the hole while 2 and 3
// stay green.
//
// 🔴 SCOPE LIMIT, stated so nobody over-reads this guard: it covers exactly
// the two files named in SCRIPTS below. It is NOT a repository-wide secret
// scan, and it contains NO filename exclusions — files outside the list are
// simply not examined. A real secret pasted into any other file (a spec, a
// service, a doc) would NOT be caught here. Widening it repo-wide needs the
// historical-session-reports decision resolved first (those reports quote
// now-disabled keys, so a repo-wide guard would start red).
// ============================================
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCRIPTS_DIR = resolve(__dirname, '../../../scripts');

const SCRIPTS = {
  createDemoUsers: {
    file: 'create-demo-users.mjs',
    requiredVars: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'DEMO_ADMIN_PASSWORD',
      'DEMO_CLIENT_PASSWORD',
    ],
  },
  smokeAuth: {
    file: 'smoke-auth.mjs',
    requiredVars: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SMOKE_KEY', 'DEMO_ADMIN_PASSWORD'],
  },
} as const;

/** Run a script with a deliberately empty environment. */
function runWithEmptyEnv(file: string) {
  return spawnSync(process.execPath, [resolve(SCRIPTS_DIR, file)], {
    env: {}, // no PATH, no secrets — nothing to fall back on
    encoding: 'utf8',
    timeout: 20_000,
  });
}

const read = (file: string) => readFileSync(resolve(SCRIPTS_DIR, file), 'utf8');

describe.each([
  ['MVT-2 create-demo-users.mjs', SCRIPTS.createDemoUsers],
  ['MVT-3 smoke-auth.mjs', SCRIPTS.smokeAuth],
])('%s — fails closed when the environment is empty', (_label, script) => {
  it('exits non-zero and names every missing variable', () => {
    const r = runWithEmptyEnv(script.file);

    // Non-zero exit is the contract: the script must refuse to act, not
    // proceed with undefined credentials.
    expect(r.status).not.toBe(0);

    // Deepest available assertion (rule #4): not merely "it failed", but
    // that the operator is told WHICH variable to set. A bare "failed" sends
    // someone hunting through source — which is how a key gets pasted back in.
    const err = `${r.stderr ?? ''}${r.stdout ?? ''}`;
    for (const v of script.requiredVars) {
      expect(err).toContain(v);
    }
  });
});

describe('MVT-4 — no credential may live in the scripts (regression guard)', () => {
  // Each pattern targets a credential SHAPE, not a filename. Truncated
  // references (e.g. "sb_secret_2EZZ…" in a doc) are intentionally below the
  // length floors, so prose about keys stays legal while real keys do not.
  const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
    ['JWT (legacy Supabase key)', /eyJ[A-Za-z0-9_-]{10,}/],
    ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{8,}/],
    ['Supabase publishable key', /sb_publishable_[A-Za-z0-9_-]{8,}/],
    ['hardcoded password literal', /password\s*:\s*['"`][^'"`\s]{3,}/],
  ];

  describe.each(Object.values(SCRIPTS).map((s) => [s.file, s] as const))(
    '%s',
    (file, script) => {
      it.each(FORBIDDEN)('contains no %s', (_name, pattern) => {
        expect(read(file)).not.toMatch(pattern);
      });

      // Paired assertion (rule #4): absence alone is satisfiable by an empty
      // file. The script must also demonstrably READ each secret from the
      // environment — proving the credential moved rather than vanished.
      it('reads every required variable from process.env', () => {
        const src = read(file);
        for (const v of script.requiredVars) {
          expect(src).toContain(`process.env.${v}`);
        }
      });
    },
  );
});
