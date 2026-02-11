import { bench, describe } from 'vitest';
import { deepEqual } from '../src/lib/utils';

function deepEqualJson(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

const smallObject = { id: '1', name: 'Exercise', completed: false };
const largeObject = {
  id: 'w1',
  name: 'Workout',
  date: '2026-02-08',
  exercises: Array.from({ length: 50 }, (_, i) => ({
    id: `ex-${i}`,
    exerciseId: `bench-${i}`,
    sets: Array.from({ length: 5 }, (_, j) => ({
      id: `set-${i}-${j}`,
      reps: 10,
      weight: 100,
      isCompleted: true
    }))
  }))
};

const largeObjectCopy = JSON.parse(JSON.stringify(largeObject));
const largeObjectDiff = JSON.parse(JSON.stringify(largeObject));
largeObjectDiff.exercises[49].sets[4].weight = 101;

describe('Deep Equal Benchmark', () => {
  bench('JSON.stringify (small match)', () => {
    deepEqualJson(smallObject, smallObject);
  });

  bench('Optimized (small match)', () => {
    deepEqual(smallObject, smallObject);
  });

  bench('JSON.stringify (large match)', () => {
    deepEqualJson(largeObject, largeObjectCopy);
  });

  bench('Optimized (large match)', () => {
    deepEqual(largeObject, largeObjectCopy);
  });

  bench('JSON.stringify (large diff)', () => {
    deepEqualJson(largeObject, largeObjectDiff);
  });

  bench('Optimized (large diff)', () => {
    deepEqual(largeObject, largeObjectDiff);
  });
});
