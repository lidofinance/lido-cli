import { Command } from 'commander';
const program = new Command();

program.option('-i, --inpersonate <address>', 'inpersonate account');
program.parse();

export { program };
