import { join } from 'path';
import { app } from 'electron';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logFile?: string;

  constructor() {
    if (process.type === 'browser') {
      const userDataPath = app.getPath('userData');
      const logsDir = join(userDataPath, 'logs');
      
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }
      
      const today = new Date().toISOString().split('T')[0];
      this.logFile = join(logsDir, `app-${today}.log`);
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  private writeToFile(formattedMessage: string): void {
    if (this.logFile) {
      try {
        writeFileSync(this.logFile, formattedMessage + '\n', { flag: 'a' });
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  public error(message: string, data?: any): void {
    const formattedMessage = this.formatMessage('ERROR', message, data);
    console.error(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  public warn(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.WARN) {
      const formattedMessage = this.formatMessage('WARN', message, data);
      console.warn(formattedMessage);
      this.writeToFile(formattedMessage);
    }
  }

  public info(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.INFO) {
      const formattedMessage = this.formatMessage('INFO', message, data);
      console.log(formattedMessage);
      this.writeToFile(formattedMessage);
    }
  }

  public debug(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      const formattedMessage = this.formatMessage('DEBUG', message, data);
      console.debug(formattedMessage);
      this.writeToFile(formattedMessage);
    }
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

export const logger = new Logger();