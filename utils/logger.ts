import { green, yellow, red } from 'chalk';
import { stringify } from './stringify';

class Logger {
  dir = console.dir;
  log = console.log;
  table = console.table;

  success(...args: unknown[]) {
    console.log(
      ...args.map((arg) => {
        if (typeof arg === 'string') return green(arg);
        if (typeof arg === 'object') return green(stringify(arg, 2));
        return green(String(arg));
      }),
    );
  }

  warn(...args: unknown[]) {
    console.warn(
      ...args.map((arg) => {
        if (typeof arg === 'string') return yellow(arg);
        if (typeof arg === 'object') return yellow(stringify(arg, 2));
        return yellow(String(arg));
      }),
    );
  }

  error(...args: unknown[]) {
    console.error(
      ...args.map((arg) => {
        if (arg instanceof Error) return red(arg.message);
        if (typeof arg === 'string') return red(arg);
        if (typeof arg === 'object') return red(stringify(arg, 2));
        return red(String(arg));
      }),
    );
  }
}

export const logger = new Logger();
