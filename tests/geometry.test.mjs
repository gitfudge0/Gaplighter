import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rect, intersect, findSpaces } from '../src/geometry.js';
const bounds = rect(0, 0, 500, 500);
test('visual neighbors are independent of DOM order', () => {
  const boxes = [rect(0,0,40,40),rect(56,0,40,40)];
  for (const items of [boxes, [...boxes].reverse()]) {
    const gaps = findSpaces(items, bounds);
    assert.equal(gaps.length, 1); assert.equal(gaps[0].value, 16);
    assert.deepEqual(gaps[0].rect, rect(40,0,16,40));
  }
});
test('wrapped rows and grid columns each get their own empty bands', () => {
  const gaps = findSpaces([rect(0,0,40,40),rect(56,0,40,40),rect(0,56,40,40),rect(56,56,40,40)], bounds);
  assert.equal(gaps.length, 4);
  assert.equal(gaps.filter(g => g.axis === 'x').length, 2);
  assert.equal(gaps.filter(g => g.axis === 'y').length, 2);
  assert(gaps.every(g => g.value === 16));
});
test('intermediate items obstruct candidate bands', () => {
  const gaps = findSpaces([rect(0,0,40,40),rect(50,0,40,40),rect(100,0,40,40)], bounds);
  assert.deepEqual(gaps.map(g => g.value), [10,10]);
});
test('overlapping and diagonal boxes do not imply empty gutters', () => {
  assert.equal(findSpaces([rect(0,0,40,40),rect(20,20,40,40)], bounds).length, 0);
  assert.equal(findSpaces([rect(0,0,40,40),rect(60,60,40,40)], bounds).length, 0);
});
test('clipping does not change the underlying measurement', () => {
  const [gap] = findSpaces([rect(0,0,40,40),rect(56,0,40,40)], rect(45,0,50,20));
  assert.equal(gap.value, 16); assert.deepEqual(gap.rect, rect(45,0,11,20));
  assert.deepEqual(intersect(rect(0,0,5,5),rect(10,10,5,5)), rect(10,10,0,0));
});
test('positive scale converts viewport distances to CSS pixels', () => {
  const [gap] = findSpaces([rect(0,0,60,60),rect(84,0,60,60)], bounds, {x:1.5,y:1.5});
  assert.equal(gap.value,16); assert.equal(gap.rect.width,24);
});
