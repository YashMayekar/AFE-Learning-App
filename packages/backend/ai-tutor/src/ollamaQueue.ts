class OllamaQueue {
    private busy = false;
    private queue: Array<() => Promise<void>> = [];

    async enqueue(task: () => Promise<void>, priority: 'high' | 'low' = 'high'): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const job = async () => {
                try {
                    await task();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            if (priority === 'high') {
                this.queue.unshift(job);
            } else {
                this.queue.push(job);
            }

            void this.drain();
        });
    }

    private async drain(): Promise<void> {
        if (this.busy || this.queue.length === 0) {
            return;
        }

        this.busy = true;
        const job = this.queue.shift();

        try {
            if (job) {
                await job();
            }
        } finally {
            this.busy = false;
            void this.drain();
        }
    }
}

export const ollamaQueue = new OllamaQueue();
