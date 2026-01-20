// Audio utilities for the training app

let audioContext: AudioContext | null = null
let isUnlocked = false

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

/**
 * Unlocks the audio context for Safari/iOS.
 * Must be called from a user interaction (click/tap) handler.
 * Call this early in the app lifecycle on any user interaction.
 */
export async function unlockAudio(): Promise<void> {
  if (isUnlocked) return

  try {
    const ctx = getAudioContext()

    // Resume if suspended
    if (ctx.state === "suspended") {
      await ctx.resume()
    }

    // Play a silent buffer to fully unlock on iOS Safari
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)

    isUnlocked = true
  } catch (error) {
    console.error("Failed to unlock audio:", error)
  }
}

/**
 * Plays a pleasant "ding" sound using Web Audio API.
 * Uses a two-tone bell-like sound for a satisfying completion notification.
 */
export async function playDingSound(): Promise<void> {
  try {
    const ctx = getAudioContext()

    // Resume audio context if suspended (required for some browsers)
    if (ctx.state === "suspended") {
      await ctx.resume()
    }

    const currentTime = ctx.currentTime

    // Create a pleasant two-tone ding
    const frequencies = [880, 1108.73] // A5 and C#6 - a major third

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(freq, currentTime)

      // Envelope for a bell-like sound
      const startTime = currentTime + index * 0.05 // Slight delay for second tone
      const duration = 0.5

      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01) // Quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration) // Decay

      oscillator.start(startTime)
      oscillator.stop(startTime + duration)
      
      // Clean up nodes after playback completes to prevent memory leaks
      oscillator.addEventListener("ended", () => {
        oscillator.disconnect()
        gainNode.disconnect()
      })
    })
  } catch (error) {
    console.error("Failed to play ding sound:", error)
  }
}
