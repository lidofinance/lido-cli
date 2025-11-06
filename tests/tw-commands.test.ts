import { describe, test, expect } from 'vitest';
import { cliRunner } from './setup';

describe('TW Commands Integration Tests', () => {
  describe('VEBO Commands', () => {
    test('Submit hash calculated from data', async () => {
      const result = await cliRunner.runCommand('vebo', [
        'submit-hash',
        '--calldata',
        '0x000001000000000f00000000000030391234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '--format',
        '1',
      ]);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);
    });

    test('Submit data with matching hash', async () => {
      const testData =
        '1,15,12345,0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const result = await cliRunner.runCommand('vebo', ['submit-data', '--data', testData]);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);
    });

    test('Trigger exit with submitted data', async () => {
      const result = await cliRunner.runCommand('vebo', [
        'trigger-exit',
        '--calldata',
        '0x000001000000000f00000000000030391234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '--format',
        '1',
        '--value',
        '0.001',
      ]);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);
    });

    test('Set exit request limits', async () => {
      const result = await cliRunner.runCommand('vebo', [
        'set-limits',
        '--max-exit-requests-limit',
        '11200',
        '--exits-per-frame',
        '1',
        '--frame-duration',
        '48',
      ]);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);
    });

    test('Get exit request limits', async () => {
      const result = await cliRunner.runCommand('vebo', ['get-limits']);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);
    });
  });

  describe('TWG Commands', () => {
    test('Set TWG exit request limits', async () => {
      const result = await cliRunner.runCommand('twg', [
        'set-limits',
        '--max-exit-requests-limit',
        '11200',
        '--exits-per-frame',
        '1',
        '--frame-duration',
        '48',
      ]);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);
    });

    test('Get TWG exit request limits', async () => {
      const result = await cliRunner.runCommand('twg', ['get-limits']);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);
    });
  });

  describe('NOR Commands', () => {
    test('Get NOR exit deadline threshold', async () => {
      const result = await cliRunner.runCommand('nor', ['get-deadline', '--node-operator-id', '0']);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);
    });
  });

  describe('sDVT Commands', () => {
    test('Get sDVT exit deadline threshold', async () => {
      const result = await cliRunner.runCommand('sdvt', ['get-deadline', '--node-operator-id', '0']);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);
    });
  });
});
