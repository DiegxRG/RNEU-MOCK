import test from 'node:test';
import assert from 'node:assert/strict';
import { histogram, executionCounts, classificationReport } from '../../src/domain/statistics.ts';

test('histogram includes both endpoints exactly once and preserves every observation', () => {
  const bins = histogram([-2, -1, 0, 0, 1, 2], 4);
  assert.deepEqual(bins.map(bin => bin.count), [1, 1, 2, 2]);
  assert.equal(bins[0].lower, -2);
  assert.equal(bins.at(-1).upper, 2);
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), 6);
});

test('histogram handles constant and empty data without NaN ranges', () => {
  assert.deepEqual(histogram([]), []);
  const bins = histogram([0, 0, 0]);
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), 3);
  assert.ok(bins.every(bin => Number.isFinite(bin.center) && bin.upper > bin.lower));
  assert.throws(() => histogram([Infinity]));
  assert.throws(() => histogram([1], 0));
});

test('status distribution accounts for every run, including intermediate states', () => {
  const statuses = ['completed','queued','preparing','running','pausing','paused','cancelled','failed'];
  const counts = executionCounts(statuses.map(status => ({status})));
  assert.deepEqual(counts.map(item => item.value), [1, 4, 1, 1, 1]);
  assert.equal(counts.reduce((sum, item) => sum + item.value, 0), statuses.length);
});

test('positive-class statistics use actual confusion counts and retain undefined ratios', () => {
  const report = classificationReport([[8, 2], [3, 7]]);
  assert.equal(report.precision, 7 / 9);
  assert.equal(report.recall, 7 / 10);
  assert.equal(report.f1, 14 / 19);
  assert.equal(report.specificity, 8 / 10);
  assert.deepEqual(classificationReport([[0,0],[0,0]]), {precision:null, recall:null, f1:null, specificity:null});
  assert.equal(classificationReport([[10,0],[5,0]]).precision, null);
  assert.equal(classificationReport([[10,0],[5,0]]).recall, 0);
});
