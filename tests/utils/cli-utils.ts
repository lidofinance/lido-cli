import { spawn } from 'child_process';
import path from 'path';
import { ANVIL_RPC_URL } from './anvil-utils';

export class CliRunner {
  async runCommand(
    command: string,
    args: string[] = [],
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(path.join(process.cwd(), 'run.sh'), [command, ...args], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          RPC_URL: ANVIL_RPC_URL,
          NETWORK: 'mainnet',
          CHAIN_ID: '1',
          EL_CHAIN_ID: '1',
          EL_NETWORK_NAME: 'mainnet',
          EL_API_PROVIDER: ANVIL_RPC_URL,
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => (stdout += data.toString()));
      child.stderr?.on('data', (data) => (stderr += data.toString()));
      child.on('close', (code) => {
        const result = { exitCode: code || 0, stdout, stderr };

        console.log(`${command} output:`, result.stdout);
        if (result.stderr.trim()) {
          console.log(`${command} stderr:`, result.stderr);
        }

        resolve(result);
      });
    });
  }

  isTestSuccessful(result: { exitCode: number; stdout: string; stderr: string }): boolean {
    if (result.stderr.trim()) {
      console.error('🚨 CLI command failed - stderr not empty:', result.stderr);
      return false;
    }

    if (result.exitCode !== 0) {
      console.error('🚨 CLI command failed with exit code:', result.exitCode);
      return false;
    }

    const errorPatterns = [
      'RPC request failed',
      'execution reverted',
      'Transaction failed',
      'Failed to submit',
      'Error:',
      'Insufficient funds',
      'insufficient funds',
      'Failed to',
      'Unable to',
      'Connection refused',
      'RPC server error',
      'Out of gas',
      'Invalid transaction',
    ];
    const hasError = errorPatterns.some((pattern) => result.stdout.toLowerCase().includes(pattern.toLowerCase()));

    if (hasError) {
      console.error('🚨 CLI command error detected in stdout:', result.stdout);
    }

    return !hasError;
  }
}
