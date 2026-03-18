type ScanState = 'idle' | 'running' | 'paused' | 'cancelled';

interface ScanController {
  getState(): ScanState;
  canStart(): boolean;
  start(): number;
  cancel(): void;
  pause(): void;
  resume(): void;
  finish(): void;
  isCurrentSession(sessionId: number): boolean;
  waitForResume(sessionId: number): Promise<void>;
}

class ScanControllerImpl implements ScanController {
  private state: ScanState = 'idle';
  private currentSessionId = 0;
  private resumeResolver: (() => void) | null = null;

  getState(): ScanState {
    return this.state;
  }

  canStart(): boolean {
    return this.state === 'idle';
  }

  start(): number {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start scan in state: ${this.state}`);
    }
    this.currentSessionId++;
    this.state = 'running';
    return this.currentSessionId;
  }

  cancel(): void {
    this.state = 'cancelled';
    this.wakeResolver();
  }

  pause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.state = 'running';
      this.wakeResolver();
    }
  }

  finish(): void {
    this.state = 'idle';
    this.resumeResolver = null;
  }

  isCurrentSession(sessionId: number): boolean {
    return sessionId === this.currentSessionId;
  }

  async waitForResume(sessionId: number): Promise<void> {
    if (!this.isCurrentSession(sessionId) || this.state !== 'paused') {
      return;
    }
    return new Promise(resolve => {
      this.resumeResolver = resolve;
    });
  }

  private wakeResolver(): void {
    if (this.resumeResolver) {
      const resolve = this.resumeResolver;
      this.resumeResolver = null;
      resolve();
    }
  }
}

export const scanController = new ScanControllerImpl();
