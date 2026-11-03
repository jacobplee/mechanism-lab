import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { verify, defaultModels, CHECKS } from '../src/index.js';

const root = new URL('../', import.meta.url);

describe('verify() (V3)', () => {
  const report = verify();

  it('every check passes on the shipped designs', () => {
    assert.equal(report.failed.length, 0, report.failed.map((r) => `${r.mechanism} ${r.id} ${r.name}: ${r.value}`).join('\n'));
    assert.equal(report.pass, true);
    assert.equal(report.passed, report.total);
  });

  it('covers every mechanism the demo animates', () => {
    const covered = new Set(report.results.map((r) => r.mechanism));
    for (const key of Object.keys(defaultModels())) assert.ok(covered.has(key), `${key} not verified`);
    assert.deepEqual(Object.keys(CHECKS).sort(), Object.keys(defaultModels()).sort());
  });

  it('returns a structured record for each check', () => {
    for (const r of report.results) {
      for (const k of ['mechanism', 'id', 'name', 'value', 'op', 'limit', 'pass']) assert.ok(k in r, `${k} missing`);
      assert.match(r.id, /^M\d[a-z]$/);
    }
  });

  it('runs every mechanism criterion listed in ACCEPTANCE.md', () => {
    const text = readFileSync(new URL('ACCEPTANCE.md', root), 'utf8');
    const ids = [];
    let section = null;
    for (const line of text.split('\n')) {
      const h = line.match(/^### (M\d) /);
      if (h) { section = h[1]; continue; }
      if (line.startsWith('## ')) section = null;
      const b = line.match(/^- ([a-z])\. /);
      if (section && b) ids.push(section + b[1]);
    }
    assert.ok(ids.length >= 50, `only found ${ids.length} criteria`);
    const ran = new Set(report.results.map((r) => r.id));
    const missing = ids.filter((id) => !ran.has(id));
    // M7b-d are per gear and M7e-h per mesh; the idler train reuses M7 under M8a.
    assert.deepEqual(missing, [], `criteria with no check: ${missing.join(', ')}`);
  });

  it('can be limited to some mechanisms', () => {
    const r = verify(defaultModels(), ['scotchYoke', 'camFollower']);
    assert.deepEqual([...new Set(r.results.map((x) => x.mechanism))], ['scotchYoke', 'camFollower']);
  });
});

describe('checks stay independent of drawing code (V1)', () => {
  it('src/checks imports only geometry, check helpers and the gear builder', () => {
    const dir = new URL('src/checks/', root);
    for (const f of readdirSync(dir)) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      for (const [, spec] of text.matchAll(/from\s+'([^']+)'/g)) {
        assert.ok(['../geom.js', './check.js', '../gears.js'].includes(spec), `${f} imports ${spec}`);
      }
    }
  });
});
