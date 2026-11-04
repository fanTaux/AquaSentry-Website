import test from 'node:test';
import assert from 'node:assert/strict';
import { components, componentMap, categories } from '../src/features/preview/data/components.js';
import { clampExplosion, filterComponents, getPartPosition } from '../src/features/preview/lib/model.js';

test('all 12 parts have unique identities and complete metadata', () => {
  assert.equal(components.length, 12);
  assert.equal(new Set(components.map((part) => part.id)).size, 12);
  for (const part of components) {
    assert.equal(componentMap[part.id], part);
    assert.ok(categories.includes(part.category));
    assert.ok(part.name && part.description && part.note && part.facts.length);
    for (const vector of [part.position, part.offset, part.label]) {
      assert.equal(vector.length, 3);
      assert.ok(vector.every(Number.isFinite));
    }
  }
});

test('assembled positions exactly match the reference origin', () => {
  for (const part of components) assert.deepEqual(getPartPosition(part, 0), part.position);
});

test('exploded positions are reversible and do not mutate metadata', () => {
  const original = structuredClone(components);
  for (const part of components) {
    assert.deepEqual(getPartPosition(part, 1), part.position.map((n, i) => n + part.offset[i]));
    assert.deepEqual(getPartPosition(part, 0.5), part.position.map((n, i) => n + part.offset[i] * 0.5));
    assert.deepEqual(getPartPosition(part, 0), part.position);
  }
  assert.deepEqual(components, original);
});

test('explosion values cannot escape the valid range', () => {
  assert.equal(clampExplosion(-10), 0);
  assert.equal(clampExplosion(10), 1);
  assert.equal(clampExplosion('0.6'), 0.6);
  for (const invalid of [NaN, Infinity, undefined, 'invalid']) assert.equal(clampExplosion(invalid), 0);
});

test('search and category filters combine without changing the source', () => {
  assert.equal(filterComponents(components, 'Semua').length, 12);
  assert.deepEqual(filterComponents(components, 'Sensor').map((part) => part.id), ['tds-probe', 'turbidity-probe']);
  assert.equal(filterComponents(components, 'Semua', '  ESP32 ').length, 1);
  assert.equal(filterComponents(components, 'Struktur', 'ESP32').length, 0);
  assert.equal(filterComponents(components, 'Semua', 'not-a-part').length, 0);
  assert.equal(components.length, 12);
});
