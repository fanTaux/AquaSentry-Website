import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

test('Preview CSS cannot style Login or existing application pages', () => {
  const css = postcss.parse(readFileSync(new URL('../src/features/preview/preview.css', import.meta.url), 'utf8'));
  css.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return;
    for (const selector of rule.selectors) {
      assert.match(selector, /^\.aquasentry-preview(?:\s|$)/, `Unscoped selector: ${selector}`);
    }
  });
  css.walkAtRules('keyframes', (rule) => assert.match(rule.params, /^aquasentry-preview-/));
  css.walkAtRules('import', () => assert.fail('Preview must not import remote/global CSS'));
});
