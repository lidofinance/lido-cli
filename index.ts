import { program } from './command';
import './programs';

program.parse(process.argv);

const originalConsoleLog = console.log;
console.log = function (...args) {
  const datetime = (new Date()).toISOString();
  originalConsoleLog.apply(console, [datetime]);
  originalConsoleLog.apply(console, [...args]);
};
