import { create } from "zustand"

interface RestTimerState {
  isRunning: boolean
  isPaused: boolean
  timeRemaining: number
  duration: number
  startedAt: number | null // timestamp when timer was started/resumed
}

interface RestTimerStore {
  timer: RestTimerState
  start: (duration: number) => void
  pause: () => void
  resume: () => void
  reset: () => void
  getTimeRemaining: () => number // Calculate current time remaining
}

const initialTimerState: RestTimerState = {
  isRunning: false,
  isPaused: false,
  timeRemaining: 0,
  duration: 0,
  startedAt: null,
}

export const useRestTimerStore = create<RestTimerStore>()((set, get) => ({
  timer: initialTimerState,

  start: (duration: number) => {
    set({
      timer: {
        isRunning: true,
        isPaused: false,
        timeRemaining: duration,
        duration,
        startedAt: Date.now(),
      },
    })
  },

  pause: () => {
    const { timer } = get()
    if (!timer.isRunning || timer.isPaused) return

    // Calculate remaining time at pause moment
    const elapsed = timer.startedAt
      ? Math.floor((Date.now() - timer.startedAt) / 1000)
      : 0
    const remaining = Math.max(0, timer.timeRemaining - elapsed)

    set({
      timer: {
        ...timer,
        isRunning: true,
        isPaused: true,
        timeRemaining: remaining,
        startedAt: null,
      },
    })
  },

  resume: () => {
    const { timer } = get()
    if (!timer.isPaused || timer.timeRemaining <= 0) return

    set({
      timer: {
        ...timer,
        isPaused: false,
        startedAt: Date.now(),
      },
    })
  },

  reset: () => {
    set({ timer: initialTimerState })
  },

  getTimeRemaining: () => {
    const { timer } = get()
    if (!timer.isRunning) return 0
    if (timer.isPaused) return timer.timeRemaining

    if (timer.startedAt) {
      const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000)
      return Math.max(0, timer.timeRemaining - elapsed)
    }

    return timer.timeRemaining
  },
}))
