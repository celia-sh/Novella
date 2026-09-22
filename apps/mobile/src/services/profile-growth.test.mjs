import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveGrowthLevelDescription,
  shouldAttemptSettingsCheckIn,
} from './profile-growth.ts';

test('growth description uses experience remaining and the next growth level', () => {
  assert.deepEqual(resolveGrowthLevelDescription({
    experience: 125,
    growthLevel: 3,
    nextLevelExperience: 400,
  }), {
    experience: 125,
    kind: 'nextLevel',
    nextGrowthLevel: 4,
    remainingExperience: 275,
  });
});

test('growth description returns the max-level state when there is no next level', () => {
  assert.deepEqual(resolveGrowthLevelDescription({
    experience: 9_999,
    growthLevel: 8,
    nextLevelExperience: null,
  }), { kind: 'maxLevel' });
});

test('Settings check-in requires a loaded profile that is not signed today', () => {
  assert.equal(shouldAttemptSettingsCheckIn(null), false);
  assert.equal(shouldAttemptSettingsCheckIn({ growth: { signedToday: true } }), false);
  assert.equal(shouldAttemptSettingsCheckIn({ growth: { signedToday: false } }), true);
});
