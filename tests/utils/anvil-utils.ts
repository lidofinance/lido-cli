import { spawn, ChildProcess } from 'child_process';
import fetch from 'node-fetch';

const ANVIL_CONFIG = {
  RPC_URL: 'https://ethereum-rpc.publicnode.com',
  PORT: 8545,
  HOST: '0.0.0.0',
  ACCOUNTS: 10,
  BALANCE: '100000',
  CHAIN_ID: '1',
  BASE_FEE: '0',
  GAS_PRICE: '1',
  GAS_LIMIT: '30000000',
} as const;

export const ANVIL_RPC_URL = `http://localhost:${ANVIL_CONFIG.PORT}`;

const ROLES = {
  SUBMITTER_ROLE: '0x22ebb4dbafb72948800c1e1afa1688772a1a4cfc54d5ebfcec8163b1139c082e',
  EXIT_REQUEST_LIMIT_MANAGER_ROLE: '0x9c616dd118785b2e2fccf45a4ff151a335ff7b6a84cd1c4d7fd9f97f39ea9342',
  TW_EXIT_LIMIT_MANAGER_ROLE: '0x03c30da9b9e4d4789ac88a294d39a63058ca4a498804c2aa823e381df59d0cf4',
} as const;

const TEST_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

export class AnvilRunner {
  private anvilInstance: ChildProcess | null = null;

  async start(): Promise<void> {
    console.log('Starting Anvil fork from Ethereum mainnet...');
    console.log(`RPC URL: ${ANVIL_CONFIG.RPC_URL}`);
    console.log(`Local port: ${ANVIL_CONFIG.PORT}`);

    await this._checkAnvilAvailable();

    this.anvilInstance = spawn('anvil', [
      '--fork-url',
      ANVIL_CONFIG.RPC_URL,
      '--port',
      ANVIL_CONFIG.PORT.toString(),
      '--host',
      ANVIL_CONFIG.HOST,
      '--accounts',
      ANVIL_CONFIG.ACCOUNTS.toString(),
      '--balance',
      ANVIL_CONFIG.BALANCE,
      '--chain-id',
      ANVIL_CONFIG.CHAIN_ID,
      '--base-fee',
      ANVIL_CONFIG.BASE_FEE,
      '--gas-price',
      ANVIL_CONFIG.GAS_PRICE,
      '--gas-limit',
      ANVIL_CONFIG.GAS_LIMIT,
    ]);

    this.anvilInstance.on('error', (error) => {
      console.error('Failed to start Anvil:', error.message);
      throw error;
    });

    this.anvilInstance.stderr?.on('data', (data) => {
      const stderrOutput = data.toString();
      console.error('Anvil stderr:', stderrOutput);

      const errorPatterns = [
        'Error:',
        'Failed to',
        'Unable to',
        'Connection refused',
        'RPC server error',
        'Transaction failed',
        'Execution reverted',
        'Out of gas',
        'Invalid transaction',
      ];
      const hasError = errorPatterns.some((pattern) => stderrOutput.toLowerCase().includes(pattern.toLowerCase()));

      if (hasError) {
        console.error('🚨 Anvil error detected, failing test:', stderrOutput);
        throw new Error(`Anvil error: ${stderrOutput.trim()}`);
      }
    });

    console.log(`Anvil started with PID: ${this.anvilInstance.pid}`);
    await this._waitForAnvil();
  }

  async stop(): Promise<void> {
    if (this.anvilInstance) {
      console.log('Stopping Anvil...');
      this.anvilInstance.kill('SIGTERM');
      this.anvilInstance = null;
    }
  }

  async setupPermissions(): Promise<void> {
    console.log('Setting up test permissions...');

    // @ts-expect-error TS1323: Dynamic import needed to load contracts after test config is applied
    const contractsModule = await import('@contracts');
    const { exitBusOracleAddress, twgAddress, aragonAgentAddress } = contractsModule;

    const contracts = {
      VEBO: exitBusOracleAddress,
      TWG: twgAddress,
    };

    const adminAccount = aragonAgentAddress;

    await this._makeJsonRpcCall('anvil_impersonateAccount', [adminAccount]);
    await this._makeJsonRpcCall('anvil_setBalance', [adminAccount, '0x56BC75E2D630E0000']);
    await this._makeJsonRpcCall('anvil_setBalance', [TEST_ACCOUNT, '0xD3C21BCECCEDA1000000']);

    const roleGrants = [
      { contract: contracts.VEBO, role: ROLES.SUBMITTER_ROLE, name: 'submitter' },
      { contract: contracts.VEBO, role: ROLES.EXIT_REQUEST_LIMIT_MANAGER_ROLE, name: 'exit request limit manager' },
      { contract: contracts.TWG, role: ROLES.TW_EXIT_LIMIT_MANAGER_ROLE, name: 'TWG exit request limit manager' },
    ];

    for (const { contract, role, name } of roleGrants) {
      console.log(`Granting ${name} role to test account...`);
      await this._runCastCommand([
        'send',
        contract,
        'grantRole(bytes32,address)',
        role,
        TEST_ACCOUNT,
        '--rpc-url',
        ANVIL_RPC_URL,
        '--from',
        adminAccount,
        '--unlocked',
        '--gas-limit',
        '200000',
      ]);
    }

    console.log('Test permissions setup completed');
  }

  async refillTestAccount(): Promise<void> {
    await this._makeJsonRpcCall('anvil_setBalance', [TEST_ACCOUNT, '0x152D02C7E14AF6800000']);
  }

  private async _checkAnvilAvailable(): Promise<void> {
    try {
      const testAnvil = spawn('anvil', ['--version']);
      await new Promise((resolve, reject) => {
        testAnvil.on('error', reject);
        testAnvil.on('close', resolve);
      });
    } catch {
      throw new Error('Anvil not found. Please install Foundry: https://getfoundry.sh/');
    }
  }

  private async _waitForAnvil(maxAttempts = 30): Promise<void> {
    console.log('Waiting for Anvil to be ready...');

    for (let i = 0; i < maxAttempts; i++) {
      try {
        await this._makeJsonRpcCall('eth_blockNumber');
        console.log(`Anvil is ready on port ${ANVIL_CONFIG.PORT}`);
        return;
      } catch {
        if (i === maxAttempts - 1) {
          throw new Error('Anvil failed to start within expected time');
        }
        console.log(`Waiting for Anvil... attempt ${i + 1}/${maxAttempts}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  private async _makeJsonRpcCall(method: string, params: any[] = []): Promise<any> {
    const response = await fetch(ANVIL_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    });

    if (!response.ok) throw new Error(`RPC call failed: ${response.statusText}`);

    const result = await response.json();
    if (result.error) throw new Error(`RPC error: ${result.error.message}`);

    return result.result;
  }

  private async _runCastCommand(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn('cast', args);
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => (stdout += data.toString()));
      child.stderr?.on('data', (data) => (stderr += data.toString()));
      child.on('close', (code) => resolve({ exitCode: code || 0, stdout, stderr }));
    });
  }
}
