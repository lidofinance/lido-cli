import { Command } from 'commander';

export const program = new Command();

program.option('-ni, --non-interactive', 'disable interactive mode');
