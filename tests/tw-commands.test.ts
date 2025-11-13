import { describe, test, expect } from 'vitest';
import { cliRunner } from './setup';

describe('TW Commands Integration Tests', () => {
  describe('VEBO Commands', () => {
    test('Submit hash and data using CSV format', async () => {
      const expectedCalldata =
        '0x000001000000000f00000000000030391234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const testData =
        '1,15,12345,0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      // First submit the hash for the expected calldata
      const hashResult = await cliRunner.runCommand('vebo', [
        'submit-hash',
        '--calldata',
        expectedCalldata,
        '--format',
        '1',
      ]);

      expect(cliRunner.isTestSuccessful(hashResult)).toBe(true);
      expect(hashResult.stdout).toContain('Hash submitted successfully!');
      expect(hashResult.stdout).toContain('Transaction confirmed in block:');
      expect(hashResult.stdout).toContain('Format: 1');

      // Then submit the matching CSV data
      const dataResult = await cliRunner.runCommand('vebo', ['submit-data', '--data', testData]);

      expect(cliRunner.isTestSuccessful(dataResult)).toBe(true);
      expect(dataResult.stdout).toContain('Parsed 1 exit request(s):');
      expect(dataResult.stdout).toContain('Module 1, Operator 15, Index 12345');
      expect(dataResult.stdout).toContain('Exit requests data submitted successfully!');
      expect(dataResult.stdout).toContain('Data format: 1');
    });

    test('Submit hash and data using hex calldata format', async () => {
      const calldata =
        '0x000002000000001400000000000054d1abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      // First submit the hash for this calldata
      const hashResult = await cliRunner.runCommand('vebo', ['submit-hash', '--calldata', calldata, '--format', '1']);

      expect(cliRunner.isTestSuccessful(hashResult)).toBe(true);
      expect(hashResult.stdout).toContain('Hash submitted successfully!');

      // Then submit the actual data using the same calldata
      const dataResult = await cliRunner.runCommand('vebo', ['submit-data', '--calldata', calldata, '--format', '1']);

      expect(cliRunner.isTestSuccessful(dataResult)).toBe(true);

      expect(dataResult.stdout).toContain('Using provided calldata with 1 exit request(s)');
      expect(dataResult.stdout).toContain('Exit requests data submitted successfully!');
      expect(dataResult.stdout).toContain('Data format: 1');
      expect(dataResult.stdout).toContain('Transaction confirmed in block:');
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

      expect(result.stdout).toContain('ETH value to send: 0.001 ETH');
      expect(result.stdout).toContain('Validator exits triggered successfully!');
      expect(result.stdout).toContain('Data format: 1');
      expect(result.stdout).toContain('Will exit all validators: [ 0 ]');
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

      expect(result.stdout).toContain('Max Exit Requests Limit: 11200');
      expect(result.stdout).toContain('Exits Per Frame: 1');
      expect(result.stdout).toContain('Frame Duration: 48 seconds');
      expect(result.stdout).toContain('Exit request limits set successfully!');
    });

    test('Get exit request limits', async () => {
      const result = await cliRunner.runCommand('vebo', ['get-limits']);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);

      expect(result.stdout).toContain('max-exit-requests-limit: 11200');
      expect(result.stdout).toContain('exits-per-frame: 1');
      expect(result.stdout).toContain('frame-duration: 48');
      expect(result.stdout).toContain('Current Exit Request Limits:');
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

      expect(result.stdout).toContain('Max exit requests limit: 11200');
      expect(result.stdout).toContain('Exits per frame: 1');
      expect(result.stdout).toContain('Frame duration (seconds): 48');
      expect(result.stdout).toContain('Exit limits updated successfully!');
    });

    test('Get TWG exit request limits', async () => {
      const result = await cliRunner.runCommand('twg', ['get-limits']);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);

      expect(result.stdout).toContain('max-exit-requests-limit: 11200');
      expect(result.stdout).toContain('exits-per-frame: 1');
      expect(result.stdout).toContain('frame-duration: 48');
    });
  });

  describe('NOR Commands', () => {
    test('Get NOR exit deadline threshold', async () => {
      const result = await cliRunner.runCommand('nor', ['get-deadline', '--node-operator-id', '0']);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);

      expect(result.stdout).toContain('Node Operator ID: 0');
      expect(result.stdout).toContain('threshold: 345600');
    });
  });

  describe('sDVT Commands', () => {
    test('Get sDVT exit deadline threshold', async () => {
      const result = await cliRunner.runCommand('sdvt', ['get-deadline', '--node-operator-id', '0']);

      expect(cliRunner.isTestSuccessful(result)).toBe(true);

      expect(result.stdout).toContain('Node Operator ID: 0');
      expect(result.stdout).toContain('threshold: 345600');
    });
  });
});
