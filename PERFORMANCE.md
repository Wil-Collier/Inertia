# Performance Improvement Plan

Prioritized performance improvements based on codebase analysis.

## Progress Summary (Last Updated: Jan 17, 2026)

**Completed: 28/38 tasks (74%)**

### ✅ Phase 1: COMPLETE (5/5 tasks)
All critical high-impact fixes have been implemented.

### ✅ Phase 2: COMPLETE (12/12 tasks)
Memoization improvements implemented:
- Added `useMemo` to expensive calculations in `WorkoutHistory`, `ExercisePickerSheet`, `ActiveWorkout`, `Dashboard`, `ProgressPage`, and `WeeklyConsistency`.
- Added `useCallback` to handlers in `ActiveWorkout`, `WorkoutTemplates`, `WorkoutHistory`, `NutritionPage`, `MealEntryItem`, and `FoodListItem`.

### ✅ Phase 3: COMPLETE (3/3 tasks)
Chart performance optimizations implemented:
- Extracted chart configuration constants in `ProgressPage` and `NutritionHistoryPage`.
- Extracted formatters and used stable references for chart props.

### ✅ Phase 4: COMPLETE (8/8 tasks)
All Zustand architecture improvements have been implemented.

### ✅ Phase 5: COMPLETE (5/5 tasks)
- Extracted and memoized list items in `ActiveWorkout`, `NutritionPage`, `WorkoutHistory`, and `ExercisePickerSheet`.
- Fixed unstable keys in `WorkoutPage` and `ProgressPage`.

### ⏳ Phase 6: PENDING (0/4 tasks)
- Phase 6: Async improvements (0/4 tasks)

---

## Summary

| Category | Issues Found | High Priority | Medium Priority |
|----------|-------------|---------------|-----------------|
| Inline objects/functions in render | 50+ | 0 | 0 |
| Missing useMemo/useCallback | 25+ | 0 | 0 |
| Zustand selector issues | 15+ | 0 | 0 |
| Async operation issues | 8 | 2 | 4 |
| List key issues | 0 | 0 | 0 |

---

## Phase 1: High-Impact Fixes (Immediate)

- [x] **`src/pages/WorkoutPage.tsx:282-284`** ✅ COMPLETED
- [x] **`src/pages/ActiveWorkout.tsx:108`** ✅ COMPLETED
- [x] **`src/pages/ActiveWorkout.tsx:361-364, 408-411`** ✅ COMPLETED
- [x] **`src/components/layout/BottomNav.tsx:22`** ✅ COMPLETED
- [x] **`src/pages/Dashboard.tsx:23-27`** ✅ COMPLETED

---

## Phase 2: Memoization Improvements

### 2.1 Expensive Calculations Without useMemo

- [x] **`src/pages/WorkoutHistory.tsx:38-56`** - Sort + groupByMonth on workouts ✅ COMPLETED
- [x] **`src/components/ExercisePickerSheet.tsx:61-70`** - `reduce()` to group exercises ✅ COMPLETED
- [x] **`src/pages/ActiveWorkout.tsx:162-166`** - `reduce()` for completedSets/totalSets ✅ COMPLETED
- [x] **`src/pages/Dashboard.tsx:40-44`** - Sort + filter recent achievements ✅ COMPLETED
- [x] **`src/pages/ProgressPage.tsx:356-362`** - Chart data filter/sort/map ✅ COMPLETED
- [x] **`src/components/dashboard/WeeklyConsistency.tsx:12-22`** - Last 7 days calculation ✅ COMPLETED

### 2.2 Missing useCallback for Handlers

- [x] **`src/pages/ActiveWorkout.tsx`** - 11+ handlers ✅ COMPLETED
- [x] **`src/pages/WorkoutTemplates.tsx`** - 8 handlers ✅ COMPLETED
- [x] **`src/pages/WorkoutHistory.tsx`** - `toggleExpand`, `handleDelete` ✅ COMPLETED
- [x] **`src/pages/NutritionPage.tsx`** - `openAddSheet`, `getEntriesByMealType`, `handleAddFood` ✅ COMPLETED
- [x] **`src/components/nutrition/MealEntryItem.tsx`** - `incrementQuantity`, `decrementQuantity`, `handleRemove` ✅ COMPLETED
- [x] **`src/components/nutrition/FoodListItem.tsx`** - 4 handlers ✅ COMPLETED

---

## Phase 3: Chart Performance (Recharts)

### 3.1 Inline Objects in Chart Props

- [x] **`src/pages/ProgressPage.tsx`** - Extract chart config constants ✅ COMPLETED
- [x] **`src/pages/NutritionHistoryPage.tsx`** - Same pattern for chart configs ✅ COMPLETED

### 3.2 Inline Formatters

- [x] Extract `tickFormatter`, `formatter`, `labelFormatter` functions outside components or wrap in `useCallback` ✅ COMPLETED

---

## Phase 4: Zustand Architecture Improvements

### 4.1 Selector Patterns to Implement

Components to update with granular selectors:

- [x] `src/components/ExercisePickerSheet.tsx:44` ✅ COMPLETED
- [x] `src/components/dashboard/WeightCard.tsx:21` ✅ COMPLETED
- [x] `src/components/StreakDisplay.tsx:6, 39` ✅ COMPLETED
- [x] `src/pages/ActiveWorkout.tsx:44-58` ✅ COMPLETED
- [x] `src/pages/SettingsPage.tsx:38` ✅ COMPLETED
- [x] `src/pages/NutritionPage.tsx:88-105` ✅ COMPLETED
- [x] `src/pages/WorkoutPage.tsx:23` ✅ COMPLETED

**Pattern:**
```tsx
// Before (inefficient)
const { settings } = useSettingsStore()
const { nutritionGoals } = settings

// After (granular)
const nutritionGoals = useSettingsStore((s) => s.settings.nutritionGoals)
```

### 4.2 Remove Redundant State

- [x] **`src/stores/settingsStore.ts:41, 121-134`** ✅ COMPLETED
  - `weightUnit` existed at both top-level AND inside `unitPreferences.weight`
  - Consolidated to single source of truth (`unitPreferences.weight`)
  - Removed redundant field from UserSettings interface
  - Simplified setWeightUnit and setUnitPreferences functions
  - Updated useWeightUnit hook to use only unitPreferences.weight

---

## Phase 5: List Item Optimizations

### 5.1 Extract List Item Components

Extract components with `React.memo` to prevent re-renders:

- [x] **`src/pages/ActiveWorkout.tsx:361-495`** - Set rows (O(n×m) inline handlers) ✅ COMPLETED
- [x] **`src/pages/NutritionPage.tsx`** - Food list items ✅ COMPLETED
- [x] **`src/pages/WorkoutHistory.tsx`** - Workout cards ✅ COMPLETED
- [x] **`src/components/ExercisePickerSheet.tsx`** - Exercise rows ✅ COMPLETED

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

- [x] **`src/pages/WorkoutPage.tsx:282-284`** ✅ COMPLETED - Missing key, add `<Fragment key={date}>`
- [x] **`src/pages/ProgressPage.tsx:666-668`** - `key={idx}` for sets, use set.id ✅ COMPLETED

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

1. **Phase 1** ✅ COMPLETE - Critical fixes (broken key, unstable hook input, excessive DB writes)
2. **Phase 4** ✅ COMPLETE - Zustand selectors (quick wins, architectural improvement)
3. **Phase 2** - High-priority useMemo additions
4. **Phase 3** - Chart constants extraction (single file changes)
5. **Phase 5** - List component extraction (more involved refactoring)
6. **Phase 6** - Async improvements

## Estimated Impact

- **Phase 1-2**: 40-50% reduction in unnecessary re-renders
- **Phase 3**: Significant improvement in chart interaction responsiveness
- **Phase 4**: ✅ Cleaner architecture, prevents future issues, reduced re-render surface area
- **Phase 5**: Major improvement for list-heavy pages (ActiveWorkout, WorkoutHistory)
