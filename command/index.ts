import { Command } from 'commander';

export const program = new Command();

program.option('--non-interactive', 'disable interactive mode');
