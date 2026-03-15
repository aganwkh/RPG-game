export class TaskQueue {
  private queue: { task: () => Promise<any>, resolve: (val: any) => void, reject: (err: any) => void }[] = [];
  private isProcessing = false;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !this.isProcessing && this.queue.length > 0) {
          this.processQueue();
        }
      });
    }
  }

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      if (!document.hidden && !this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.isProcessing || document.hidden) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && !document.hidden) {
      const item = this.queue.shift();
      if (item) {
        try {
          const result = await item.task();
          item.resolve(result);
        } catch (error) {
          console.error('Task execution failed:', error);
          item.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }
}

export const backgroundTaskQueue = new TaskQueue();
