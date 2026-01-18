# Performance Improvement Plan

Prioritized performance improvements based on codebase analysis.

## Summary

| Category | Issues Found | High Priority | Medium Priority |
|----------|-------------|---------------|-----------------|
| Inline objects/functions in render | 50+ | 15 | 35+ |
| Missing useMemo/useCallback | 25+ | 5 | 15+ |
| Zustand selector issues | 15+ | 3 | 10+ |
| Async operation issues | 8 | 2 | 4 |
| List key issues | 6 | 2 | 1 |

---

## Phase 1: High-Impact Fixes (Immediate)

### 1.1 Critical List Rendering Bug

- [ ] **`src/pages/WorkoutPage.tsx:282-284`**
  - Issue: Outer `.map()` returns inner map result without a key
  - Impact: React reconciliation breaks for workout groups by date
  - Fix: Wrap inner map in `<Fragment key={date}>` or restructure

### 1.2 Unstable Array Reference to Hook

- [ ] **`src/pages/ActiveWorkout.tsx:108`**
  ```tsx
  const exerciseIds = workout.exercises.map(e => e.exerciseId)
  const exerciseMap = useExercisesByIdsDB(exerciseIds)
  ```
  - Issue: `exerciseIds` creates new array reference every render, triggering unnecessary DB queries
  - Fix: Wrap in `useMemo(() => workout.exercises.map(e => e.exerciseId), [workout.exercises])`

### 1.3 Missing Debounce on DB-Writing Inputs

- [ ] **`src/pages/ActiveWorkout.tsx:361-364, 408-411`**
  - Issue: Weight/reps inputs call `updateSet()` on every keystroke, writing to IndexedDB each time
  - Impact: Heavy I/O on every keypress during active workout
  - Fix: Implement debounced update (300-500ms) or use local state + onBlur pattern

### 1.4 Non-Granular Zustand Selectors in High-Traffic Components

- [ ] **`src/components/layout/BottomNav.tsx:22`**
  ```tsx
  const { activeSession } = useWorkoutStore()
  ```
  - Issue: Subscribes to entire `activeSession` object (renders on every route)
  - Fix: `const hasActiveSession = useWorkoutStore((s) => !!s.activeSession)`

- [ ] **`src/pages/Dashboard.tsx:23-27`**
  - Issue: Multiple store subscriptions without granularity
  - Fix: Use specific selectors like `(s) => s.settings.nutritionGoals`

---

## Phase 2: Memoization Improvements

### 2.1 Expensive Calculations Without useMemo

- [ ] **`src/pages/WorkoutHistory.tsx:38-56`** - Sort + groupByMonth on workouts (High)
- [ ] **`src/components/ExercisePickerSheet.tsx:61-70`** - `reduce()` to group exercises (High)
- [ ] **`src/pages/ActiveWorkout.tsx:162-166`** - `reduce()` for completedSets/totalSets (Medium)
- [ ] **`src/pages/Dashboard.tsx:40-44`** - Sort + filter recentAchievements (Medium)
- [ ] **`src/pages/ProgressPage.tsx:356-362`** - Chart data filter/sort/map (Medium)
- [ ] **`src/components/dashboard/WeeklyConsistency.tsx:12-22`** - Last 7 days calculation (Medium)

### 2.2 Missing useCallback for Handlers

- [ ] **`src/pages/ActiveWorkout.tsx`** - 11+ handlers: `handleFinish`, `handleCancel`, `toggleExpanded`, `handleAddExercise`, etc.
- [ ] **`src/pages/WorkoutTemplates.tsx`** - 8 handlers: `handleDelete`, `handleCreate`, `handleStartFromTemplate`, `handleEditOpen`, etc.
- [ ] **`src/pages/WorkoutHistory.tsx`** - `toggleExpand`, `handleDelete`
- [ ] **`src/pages/NutritionPage.tsx`** - `openAddSheet`, `getEntriesByMealType`, `handleAddFood`
- [ ] **`src/components/nutrition/MealEntryItem.tsx`** - `incrementQuantity`, `decrementQuantity`, `handleRemove`
- [ ] **`src/components/nutrition/FoodListItem.tsx`** - 4 handlers

---

## Phase 3: Chart Performance (Recharts)

### 3.1 Inline Objects in Chart Props

- [ ] **`src/pages/ProgressPage.tsx`** - Extract chart config constants:
  ```tsx
  // Before (new object every render)
  tick={{ fontSize: 12 }}
  contentStyle={{ backgroundColor: "...", border: "...", borderRadius: "8px" }}
  dot={{ fill: "hsl(var(--primary))" }}
  domain={["dataMin - 2", "dataMax + 2"]}
  
  // After (module-level constants)
  const CHART_TICK = { fontSize: 12 } as const
  const TOOLTIP_STYLE = { backgroundColor: "...", ... } as const
  const DOT_CONFIG = { fill: "hsl(var(--primary))" } as const
  ```

- [ ] **`src/pages/NutritionHistoryPage.tsx`** - Same pattern for chart configs

### 3.2 Inline Formatters

- [ ] Extract `tickFormatter`, `formatter`, `labelFormatter` functions outside components or wrap in `useCallback`

---

## Phase 4: Zustand Architecture Improvements

### 4.1 Selector Patterns to Implement

Components to update with granular selectors:

- [ ] `src/components/ExercisePickerSheet.tsx:44`
- [ ] `src/components/dashboard/WeightCard.tsx:21`
- [ ] `src/components/StreakDisplay.tsx:6, 39`
- [ ] `src/pages/ActiveWorkout.tsx:44-58`
- [ ] `src/pages/SettingsPage.tsx:38`
- [ ] `src/pages/NutritionPage.tsx:88-105`
- [ ] `src/pages/WorkoutPage.tsx:23`

**Pattern:**
```tsx
// Before (inefficient)
const { settings } = useSettingsStore()
const { nutritionGoals } = settings

// After (granular)
const nutritionGoals = useSettingsStore((s) => s.settings.nutritionGoals)
```

### 4.2 Remove Redundant State

- [ ] **`src/stores/settingsStore.ts:41, 121-134`**
  - `weightUnit` exists at both top-level AND inside `unitPreferences.weight`
  - Consolidate to single source of truth

---

## Phase 5: List Item Optimizations

### 5.1 Extract List Item Components

Extract components with `React.memo` to prevent re-renders:

- [ ] **`src/pages/ActiveWorkout.tsx:361-495`** - Set rows (O(n×m) inline handlers)
- [ ] **`src/pages/NutritionPage.tsx`** - Food list items
- [ ] **`src/pages/WorkoutHistory.tsx`** - Workout cards
- [ ] **`src/components/ExercisePickerSheet.tsx`** - Exercise rows

**Pattern:**
```tsx
// Before: inline handlers multiply
{exercises.map(ex => (
  <div onClick={() => handleClick(ex.id)}>...</div>
))}

// After: extracted component with stable handlers
const ExerciseRow = memo(({ exercise, onClick }) => {
  return <div onClick={onClick}>...</div>
})
```

### 5.2 Key Props Fixes

- [ ] **`src/pages/WorkoutPage.tsx:282-284`** - Missing key, add `<Fragment key={date}>`
- [ ] **`src/pages/ProgressPage.tsx:666-668`** - `key={idx}` for sets, use set.id or composite key

---

## Phase 6: Async Improvements

### 6.1 Add Debounce to Search

- [ ] **`src/components/ExercisePickerSheet.tsx:97`**
  - Currently triggers DB query on every keystroke
  - Follow pattern from `NutritionPage.tsx:150-156` (500ms debounce)

### 6.2 Race Condition Guards

- [ ] **`src/components/DevSeedingHandler.tsx:10-27`** - Add `isMounted` cleanup flag
- [ ] **`src/components/ExercisePickerSheet.tsx:52-58`** - Add cleanup for async `init()` call

### 6.3 Loading States

- [ ] **`src/components/dashboard/WeightCard.tsx:34-45`**
  - `addEntry` called synchronously, success toast shown before completion
  - Add `isLoading` state and `await` the operation

---

## Implementation Order

1. **Phase 1** - Critical fixes (broken key, unstable hook input, excessive DB writes)
2. **Phase 4.1** - Zustand selectors (quick wins, architectural improvement)
3. **Phase 2.1** - High-priority useMemo additions
4. **Phase 3** - Chart constants extraction (single file changes)
5. **Phase 5** - List component extraction (more involved refactoring)
6. **Phase 6** - Async improvements

## Estimated Impact

- **Phase 1-2**: 40-50% reduction in unnecessary re-renders
- **Phase 3**: Significant improvement in chart interaction responsiveness
- **Phase 4**: Cleaner architecture, prevents future issues
- **Phase 5**: Major improvement for list-heavy pages (ActiveWorkout, WorkoutHistory)
