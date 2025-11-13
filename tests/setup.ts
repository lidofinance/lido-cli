import { beforeAll, afterAll, beforeEach } from 'vitest';
import { AnvilRunner, CliRunner } from './utils';

export const MAINNET_TEST_CONFIG = {
  DEPLOYED: 'deployed-mainnet.json',
  EL_CHAIN_ID: '1',
  EL_NETWORK_NAME: 'mainnet',
  EL_API_PROVIDER: 'http://127.0.0.1:8545',
  CHAIN_ID: '1',
  NETWORK: 'mainnet',
  LIDO_CLI_NON_INTERACTIVE: 'true',
  PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
} as const;

export function applyTestConfig(config: typeof MAINNET_TEST_CONFIG = MAINNET_TEST_CONFIG): void {
  console.log('🔧 Applying test configuration (overriding .env)...');
  console.log(`   DEPLOYED: ${config.DEPLOYED}`);
  console.log(`   NETWORK: ${config.NETWORK}`);
  console.log(`   CHAIN_ID: ${config.CHAIN_ID}`);

  Object.entries(config).forEach(([key, value]) => {
    if (value !== undefined) {
      process.env[key] = value;
    }
  });

  console.log('✅ Test configuration applied successfully');
}

applyTestConfig();

export let anvilRunner: AnvilRunner;
export let cliRunner: CliRunner;

beforeAll(async () => {
  console.log('Starting test suite...');

  anvilRunner = new AnvilRunner();
  cliRunner = new CliRunner();

  await anvilRunner.start();
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await anvilRunner.setupPermissions();
});

beforeEach(async () => {
  await anvilRunner.refillTestAccount();
});

afterAll(async () => {
  if (anvilRunner) {
    await anvilRunner.stop();
  }
  console.log('Test suite completed.');
});
