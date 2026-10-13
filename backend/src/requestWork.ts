export class RequestCapacityError extends Error {}

export class RequestWork {
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly active = new Map<string, number>();

  run<T>(
    key: string,
    installationId: string,
    retrieve: () => Promise<T>,
  ): Promise<T> {
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<T>;
    const active = this.active.get(installationId) ?? 0;
    if (active >= 4 || this.pending.size >= 100)
      return Promise.reject(
        new RequestCapacityError("Refresh capacity exceeded"),
      );
    this.active.set(installationId, active + 1);
    const task = Promise.resolve()
      .then(retrieve)
      .finally(() => {
        this.pending.delete(key);
        const remaining = (this.active.get(installationId) ?? 1) - 1;
        if (remaining) this.active.set(installationId, remaining);
        else this.active.delete(installationId);
      });
    this.pending.set(key, task);
    return task;
  }
}
