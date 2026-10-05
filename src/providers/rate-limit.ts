/**
 * Sequential leaky bucket.
 * Free GMGN tier is 5/5 (rate/burst): one request in flight, burst 5, then pace.
 */

export type SleepFn = (ms: number) => Promise<void>;

export class SequentialBucket {
  private tokens: number;
  private updatedAt: number;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly ratePerSec: number,
    private readonly burst: number,
    private readonly sleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly now: () => number = () => Date.now(),
  ) {
    this.tokens = burst;
    this.updatedAt = now();
  }

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      await this.take();
      return fn();
    });
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async take(): Promise<void> {
    for (;;) {
      const t = this.now();
      const elapsedSec = Math.max(0, (t - this.updatedAt) / 1000);
      this.tokens = Math.min(this.burst, this.tokens + elapsedSec * this.ratePerSec);
      this.updatedAt = t;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.ratePerSec) * 1000);
      await this.sleep(Math.max(waitMs, 1));
    }
  }
}

export const GMGN_FREE_RATE = 5;
export const GMGN_FREE_BURST = 5;

/**
 * One retry when the reset is soon. A long ban is not retried: extra calls
 * extend a GMGN ban. Unknown reset waits one second, once.
 */
export function gmgnRetryWaitMs(args: {
  httpStatus: number;
  apiError?: string | null;
  resetAtUnix?: number | null;
  nowMs: number;
  attempt: number;
}): number | null {
  const rateLimited = args.httpStatus === 429
    || args.apiError === 'RATE_LIMIT_EXCEEDED'
    || args.apiError === 'RATE_LIMIT_BANNED';
  if (!rateLimited) return null;
  if (args.attempt >= 1) return null;
  if (args.resetAtUnix == null) return 1000;
  const wait = Math.max(args.resetAtUnix * 1000 - args.nowMs, 0) + 1000;
  if (wait > 5000) return null;
  return wait;
}
