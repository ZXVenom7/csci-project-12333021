'use strict';

/**
 * Creates an administrator account (or resets its password with --reset).
 *
 *   npm run admin:create                      interactive prompts
 *   npm run admin:create -- --email a@b.c --name "Jane Doe" [--role owner|editor] [--reset]
 *
 * Non-interactive (CI / hosting consoles): set ADMIN_EMAIL, ADMIN_NAME and
 * ADMIN_PASSWORD in the environment for this one command. The password is
 * never stored anywhere except as a bcrypt hash in the database.
 */
const readline = require('readline');
const { assertConfig } = require('../config');
const { query, closePool } = require('../db/pool');
const { hashPassword } = require('../lib/auth');
const { parse, userCreateSchema } = require('../lib/validate');

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Do not echo the password while typing.
      rl._writeToOutput = (text) => {
        if (text.includes(question)) process.stdout.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  assertConfig();
  const interactive = process.stdin.isTTY;
  const reset = process.argv.includes('--reset');
  const email = argument('email') || process.env.ADMIN_EMAIL || (interactive ? await ask('Email: ') : '');
  const name = argument('name') || process.env.ADMIN_NAME || (interactive && !reset ? await ask('Full name: ') : 'Administrator');
  const role = argument('role') || 'owner';
  const password = process.env.ADMIN_PASSWORD || (interactive ? await ask('Password (min 10 characters): ', { hidden: true }) : '');

  let input;
  try {
    input = parse(userCreateSchema, { email, name, role, password });
  } catch (error) {
    const fields = (error.details && error.details.fields) || {};
    throw new Error(`Invalid input:\n${Object.entries(fields).map(([field, message]) => ` - ${field}: ${message}`).join('\n')}`);
  }

  const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [input.email]);
  const hash = await hashPassword(input.password);
  if (existing.rows[0]) {
    if (!reset) throw new Error(`An account for ${input.email} already exists. Add --reset to set a new password.`);
    await query(
      `UPDATE users SET password_hash = $1, is_active = true, token_version = token_version + 1, updated_at = now()
       WHERE id = $2`,
      [hash, existing.rows[0].id],
    );
    console.log(`Password reset for ${input.email}.`);
  } else {
    await query('INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4)',
      [input.email, input.name, input.role, hash]);
    console.log(`Created ${input.role} account for ${input.email}. Sign in at /admin.`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
