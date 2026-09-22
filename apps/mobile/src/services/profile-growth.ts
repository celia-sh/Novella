import type { UserGrowth, UserProfile } from '@novella/api-client';

export type GrowthLevelDescription =
  | {
      kind: 'nextLevel';
      experience: number;
      remainingExperience: number;
      nextGrowthLevel: number;
    }
  | {
      kind: 'maxLevel';
    };

export function resolveGrowthLevelDescription(
  growth: Pick<UserGrowth, 'experience' | 'growthLevel' | 'nextLevelExperience'>,
): GrowthLevelDescription {
  if (growth.nextLevelExperience === null) return { kind: 'maxLevel' };

  return {
    experience: growth.experience,
    kind: 'nextLevel',
    nextGrowthLevel: growth.growthLevel + 1,
    remainingExperience: growth.nextLevelExperience - growth.experience,
  };
}

export function shouldAttemptSettingsCheckIn(
  profile: Pick<UserProfile, 'growth'> | null,
): boolean {
  return profile?.growth.signedToday === false;
}
