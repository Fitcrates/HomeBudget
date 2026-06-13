import type { ScoringStrategy } from "./types";
import { defaultScoringStrategy } from "./defaultStrategy";
import { marginFirstStrategy } from "./marginFirstStrategy";

const strategies: ScoringStrategy[] = [defaultScoringStrategy, marginFirstStrategy];

function hashToBucket(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

export function selectStrategy(householdId: string): ScoringStrategy {
  return hashToBucket(householdId) < 15 ? marginFirstStrategy : defaultScoringStrategy;
}

export function listScoringStrategies() {
  return strategies;
}
