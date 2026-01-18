# Code Review Guidelines

Principles and practices for reviewing code in this codebase.

---

## Performance

### React Rendering
- [ ] Avoid creating new objects/arrays/functions in render (causes unnecessary re-renders)
- [ ] Use `useMemo` for expensive calculations, `useCallback` for callbacks passed to children
- [ ] Check for missing dependencies in `useEffect`/`useMemo`/`useCallback` arrays
- [ ] Avoid inline object styles - prefer Tailwind classes or stable style objects
- [ ] Ensure lists have stable, unique `key` props (not array index for dynamic lists)

### Data & State
- [ ] Avoid redundant state - derive values when possible instead of syncing state
- [ ] Check for state that could be lifted to URL params or derived from existing state
- [ ] Verify Zustand selectors are granular (select only what's needed)
- [ ] Avoid storing derived data in state - compute it instead

### Async Operations
- [ ] Check for race conditions in effects (use cleanup/abort controllers)
- [ ] Avoid `await` in loops - use `Promise.all` for parallel operations
- [ ] Debounce/throttle expensive operations triggered by user input

---

## Bugs & Correctness

### Null/Undefined Handling
- [ ] Check for potential `undefined` access on optional properties
- [ ] Verify array methods handle empty arrays correctly
- [ ] Ensure optional chaining (`?.`) is used where data may be missing
- [ ] Check default values make sense (empty string vs `undefined` vs `null`)

### State Management
- [ ] Verify state updates don't depend on stale closures
- [ ] Check for missing `await` on async store actions
- [ ] Ensure optimistic updates have proper rollback on error
- [ ] Verify store initialization completes before dependent code runs

### Edge Cases
- [ ] Empty states (no data, first-time user)
- [ ] Loading states (skeleton, spinner, disabled interactions)
- [ ] Error states (network failure, invalid data)
- [ ] Boundary conditions (zero, negative, max values)

### Effects & Cleanup
- [ ] Verify `useEffect` cleanup functions prevent memory leaks
- [ ] Check that subscriptions/timers are properly cleaned up
- [ ] Ensure effects don't run more often than necessary

---

## Security

### Data Handling
- [ ] Never log sensitive data (passwords, tokens, PII)
- [ ] Sanitize user input before displaying (XSS prevention)
- [ ] Validate data from external sources before use
- [ ] Check that API keys/secrets aren't hardcoded or exposed

### Storage
- [ ] Sensitive data should not be stored in localStorage/IndexedDB unencrypted
- [ ] Verify no credentials are committed to the repository

---

## Maintainability

### Code Organization
- [ ] Single responsibility - functions/components do one thing well
- [ ] Appropriate file length (consider splitting if >300 lines)
- [ ] Related code is co-located (feature folders over type folders)
- [ ] No dead code, commented-out code, or unused imports

### Naming & Clarity
- [ ] Names describe intent, not implementation
- [ ] Boolean variables/props use `is`, `has`, `should` prefixes
- [ ] Event handlers use `handle` prefix, callbacks use `on` prefix
- [ ] Avoid abbreviations unless universally understood

### Types
- [ ] No `any` types - use proper typing or `unknown` with type guards
- [ ] Interfaces for object shapes, types for unions/aliases
- [ ] Use `import type` for type-only imports
- [ ] Avoid type assertions (`as`) - prefer type guards

### DRY & Abstraction
- [ ] Avoid premature abstraction - wait for 3+ instances
- [ ] Shared logic extracted to hooks or utility functions
- [ ] Magic numbers/strings extracted to named constants
- [ ] Consistent patterns across similar code

---

## Accessibility

### Semantic HTML
- [ ] Use appropriate HTML elements (`button` not `div` for clicks)
- [ ] Headings follow hierarchy (`h1` > `h2` > `h3`)
- [ ] Form inputs have associated labels
- [ ] Images have meaningful `alt` text

### Keyboard & Focus
- [ ] Interactive elements are keyboard accessible
- [ ] Focus order is logical
- [ ] Focus is managed appropriately in modals/dialogs
- [ ] No keyboard traps

### Screen Readers
- [ ] ARIA attributes used correctly (prefer semantic HTML first)
- [ ] Dynamic content changes are announced
- [ ] Icons have `aria-label` or are hidden with `aria-hidden`

---

## UI/UX

### Consistency
- [ ] Uses design system components (shadcn/ui)
- [ ] Consistent spacing (Tailwind spacing scale)
- [ ] Consistent color usage (theme CSS variables)
- [ ] Follows existing patterns in the codebase

### Responsiveness
- [ ] Works on mobile viewport (375px+)
- [ ] Touch targets are at least 44x44px
- [ ] Text is readable without zooming
- [ ] PWA safe areas respected (`safe-area-bottom`)

### Feedback
- [ ] User actions have visible feedback
- [ ] Loading states for async operations
- [ ] Error messages are helpful and actionable
- [ ] Success confirmations where appropriate

---

## Testing Considerations

### Testability
- [ ] Pure functions where possible (easier to test)
- [ ] Side effects isolated and injectable
- [ ] Components accept props for testing different states
- [ ] Complex logic separated from UI components

### Coverage Priorities
- [ ] Critical paths (checkout, data saving, auth)
- [ ] Complex business logic
- [ ] Edge cases identified in code review
- [ ] Regression-prone areas

---

## Code Review Process

### Before Requesting Review
1. Self-review your own diff first
2. Run `pnpm build && pnpm lint` - fix all errors
3. Test manually on mobile viewport
4. Write clear PR description explaining the "why"

### As a Reviewer
1. Understand the context - read the PR description
2. Check the big picture first, then details
3. Ask questions rather than make demands
4. Distinguish between blocking issues and suggestions
5. Approve when "good enough" - perfect is the enemy of done

### Responding to Feedback
1. Assume good intent
2. Explain your reasoning if you disagree
3. If unsure, discuss synchronously
4. Thank reviewers for their time

---

