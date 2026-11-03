// Shared test helpers.

import assert from 'node:assert/strict';

/** Every check in the list passes; on failure, name the ones that did not. */
export function allPass(results) {
  const bad = results.filter((r) => !r.pass);
  assert.equal(bad.length, 0, bad.map((r) => `${r.id} ${r.name}: ${r.value}`).join('\n'));
}

/** At least one check with this id fails. Used by the mutation tests. */
export function fails(results, id) {
  const hit = results.filter((r) => r.id === id);
  assert.ok(hit.length, `no check with id ${id}`);
  assert.ok(hit.some((r) => !r.pass), `${id} should have failed but passed: ${hit.map((r) => r.value).join(', ')}`);
}

/** A copy of a model with some of its parts replaced. */
export const mutate = (model, over) => ({ ...model, ...over, geometry: { ...model.geometry, ...(over.geometry || {}) } });
