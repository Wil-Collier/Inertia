// Audio utilities for the training app

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

/**
 * Plays a pleasant "ding" sound using Web Audio API.
 * Uses a two-tone bell-like sound for a satisfying completion notification.
 */
export function playDingSound(): void {
  try {
    const ctx = getAudioContext()
    const currentTime = ctx.currentTime

    // Resume audio context if suspended (required for some browsers)
    if (ctx.state === "suspended") {
      ctx.resume()
    }

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
    })
  } catch (error) {
    console.error("Failed to play ding sound:", error)
  }
}
