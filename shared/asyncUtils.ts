export async function runSequentially<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  // Preserve a single promise chain without Array.reduce to avoid transaction context issues.
  let chain = Promise.resolve()
  for (const item of items) {
    chain = chain.then(() => task(item))
  }
  await chain
}
