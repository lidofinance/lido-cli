import { Command } from 'commander';
const program = new Command();

program.option('-i, --impersonate <address>', 'impersonate account');
program.parse();

export { program };
