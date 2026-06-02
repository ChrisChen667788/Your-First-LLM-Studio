export async function runBenchmarkTasksSequentially<T>(
  tasks: T[],
  runner: (task: T) => Promise<unknown>,
) {
  const samples: unknown[] = [];
  for (const task of tasks) {
    samples.push(await runner(task));
  }
  return samples;
}

export async function runBenchmarkTasksWithConcurrency<T, R>(
  tasks: T[],
  concurrency: number,
  runner: (task: T) => Promise<R>,
  options?: {
    beforeEach?: () => void | Promise<void>;
  },
) {
  const safeConcurrency = Math.max(1, Math.min(concurrency, tasks.length || 1));
  const results = new Array<R>(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      if (options?.beforeEach) {
        await options.beforeEach();
      }
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= tasks.length) return;
      results[currentIndex] = await runner(tasks[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
  return results;
}

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  options?: {
    beforeEach?: () => void | Promise<void>;
  },
) {
  const safeConcurrency = Math.max(1, Math.min(concurrency, tasks.length || 1));
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      if (options?.beforeEach) {
        await options.beforeEach();
      }
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= tasks.length) return;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
  return results;
}
