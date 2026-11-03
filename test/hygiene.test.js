// Repository hygiene (P1, P2, P4, P5, P6).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const TEXT = new Set(['.js', '.mjs', '.json', '.md', '.html', '.css', '.txt', '']);
const SKIP = new Set(['.git', 'node_modules']);

function files(dir = root) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (TEXT.has(extname(name))) out.push(p);
  }
  return out;
}

describe('repository hygiene', () => {
  const all = files().map((p) => ({ path: relative(root, p), text: readFileSync(p, 'utf8') }));

  it('P5: no email addresses, phone numbers or home-directory paths', () => {
    const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]*[A-Za-z]{2,}/;
    const phone = /\+?\d{1,2}[\s.-]?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;
    const home = new RegExp(['/' + 'Users' + '/', '/' + 'home' + '/', 'C:\\\\' + 'Users'].join('|'));
    for (const { path, text } of all) {
      assert.doesNotMatch(text, email, `${path} contains an email address`);
      assert.doesNotMatch(text, phone, `${path} contains a phone number`);
      assert.doesNotMatch(text, home, `${path} contains a home-directory path`);
    }
  });

  it('P1: no npm dependencies; npm test is node --test', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.devDependencies, undefined);
    assert.equal(pkg.scripts.test, 'node --test');
  });

  it('P4: MIT licence, copyright and author Jacob Lee', () => {
    const lic = readFileSync(join(root, 'LICENSE'), 'utf8');
    assert.match(lic, /^MIT License/);
    assert.match(lic, /Copyright \(c\) \d{4} Jacob Lee/);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.author, 'Jacob Lee');
    assert.equal(pkg.license, 'MIT');
  });

  it('P2: the library never touches the DOM', () => {
    for (const { path, text } of all.filter((f) => f.path.startsWith('src'))) {
      assert.doesNotMatch(text, /\b(document|window|navigator)\s*\./, `${path} uses the DOM`);
    }
  });

  it('P6: nothing carried over from the source site', () => {
    const leftovers = /perforat|scrollY|scroll-driven|title ?block|roughSharp|tractor|\.webp/i;
    for (const { path, text } of all.filter((f) => !f.path.startsWith('test') && f.path !== 'ACCEPTANCE.md' && f.path !== 'REPORT.md')) {
      assert.doesNotMatch(text, leftovers, `${path} still mentions the source site`);
    }
  });

  it('R1: README has no em dashes and no hype words', () => {
    const readme = all.find((f) => f.path === 'README.md');
    if (!readme) return;
    assert.doesNotMatch(readme.text, /\u2014/, 'README contains an em dash');
    assert.doesNotMatch(readme.text, /\b(passionate|blazing|revolutionary|cutting-edge|seamless|powerful|robust|stunning)\b/i);
  });
});
