/** Retry transient transport/server failures only. The caller must reuse its idempotency key. */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (
        attempt >= retries ||
        (status !== undefined && ![0, 502, 503, 504].includes(status))
      )
        throw error;
      await sleep(400 * 2 ** attempt + Math.random() * 350);
    }
  }
}
