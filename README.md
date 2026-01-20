# Training App (PWA)

A powerful, offline-first Progressive Web App (PWA) for tracking workouts, nutrition, and body progress. Built with a focus on speed, privacy, and seamless user experience.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0--alpha-orange.svg)

## Key Features

### Workout Tracking
- **Comprehensive Logging:** Track sets, reps, weight, and RPE for every exercise.
- **Workout Templates:** Create and save your favorite routines for quick starting.
- **Active Session Management:** Live rest timers, elapsed time tracking, and easy set management.
- **Exercise Database:** Searchable database of 1,000+ exercises with instructions and muscle group tagging.

### Nutrition & Macros
- **Daily Logging:** Track calories, protein, carbs, and fats.
- **Barcode Scanner:** Quickly log food using the integrated camera scanner.
- **OpenFoodFacts Integration:** Access a massive database of food products worldwide.
- **Meal Templates:** Save frequent meals as templates for one-tap logging.

### Progress & Analytics
- **Body Weight Tracking:** Monitor your weight trends with interactive charts.
- **Muscle Balance:** Visualize which muscle groups you're targeting over time.
- **Exercise PRs:** Track personal records and volume trends for specific lifts.
- **Gamified Achievements:** Earn badges and maintain streaks to stay motivated.

### Privacy & Offline First
- **Local-First Storage:** Your data stays on your device using IndexedDB (Dexie).
- **Offline Capable:** Works perfectly without an internet connection.
- **Data Portability:** Export your entire database as a JSON backup and import it on any device.
- **PWA Ready:** Install it on your home screen for a native-like experience.

## Tech Stack

- **Framework:** [React 19](https://react.dev/)
- **Build Tool:** [Vite 7](https://vitejs.dev/)
- **Language:** [TypeScript 5.9](https://www.typescriptlang.org/)
- **Routing:** [TanStack Router](https://tanstack.com/router)
- **Data Fetching:** [TanStack Query v5](https://tanstack.com/query)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) (Base Nova)
- **Database:** [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- **Charts:** [Recharts](https://recharts.org/)
- **Icons:** [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or higher recommended)
- [pnpm](https://pnpm.io/) (preferred package manager)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/training-app.git
   cd training-app
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Scripts
- `pnpm dev`: Starts the development server.
- `pnpm build`: Runs type-checking and builds the production app.
- `pnpm lint`: Runs Oxlint for fast, type-aware linting.
- `pnpm preview`: Previews the production build locally.
- `pnpm seed`: Opens the app with a `?seed=true` flag to populate the database with test data (development only).

## Mobile Installation

Since this is a Progressive Web App, you can install it on your device:
- **iOS:** Open in Safari, tap "Share", and select "Add to Home Screen".
- **Android:** Open in Chrome, tap the three dots menu, and select "Install app".

## License

This project is licensed under the MIT License - see the LICENSE file for details.


