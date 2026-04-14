import { provider } from '@providers';
import { agentOrDirect, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, logger } from '@utils';
import { Contract, Interface } from 'ethers';

const CIRCUIT_BREAKER = '0x44a5789dFeDa59cD176Ab5709ec2F4829dE4d555';

const GATE_SEAL_ADDRESSES = [
  '0x73d76Bd3D589B2b2185c402da82cdAfbc18b958D', // GateSeal (Withdrawal Queue)
  '0x368f2fcb593170823cc844F1B29e75E3d26879A1', // GateSeal (VEB and TWG)
  '0x2291496c76CC2e9368DbE9d4977ED2623cbDfb32', // GateSeal (VaultHub and PredepositGuarantee)
  '0x725166f143DdcD9EC1b96dfb70f16E3f44968A65', // GateSeal (CSM)
];

const gateSealIface = new Interface([
  'function get_sealing_committee() view returns (address)',
  'function get_sealables() view returns (address[])',
]);

const aclIface = new Interface([
  'function PAUSE_ROLE() view returns (bytes32)',
  'function grantRole(bytes32,address)',
  'function revokeRole(bytes32,address)',
]);

const circuitBreakerIface = new Interface([
  'function registerPauser(address,address)',
]);

export const circuitBreakerReplaceGateseals = async () => {
  const calls: CallScriptAction[] = [];
  const descriptions: string[] = [];
  let step = 1;

  for (const gateSealAddress of GATE_SEAL_ADDRESSES) {
    const gateSeal = new Contract(gateSealAddress, gateSealIface, provider);

    const sealingCommittee: string = await gateSeal.get_sealing_committee();
    const sealables: string[] = await gateSeal.get_sealables();

    logger.log(`GateSeal ${gateSealAddress}:`);
    logger.log(`  sealing_committee: ${sealingCommittee}`);
    logger.log(`  sealables: ${sealables.join(', ')}`);

    for (const sealable of sealables) {
      const sealableContract = new Contract(sealable, aclIface, provider);
      const pauseRoleHash: string = await sealableContract.PAUSE_ROLE();

      // Revoke PAUSE_ROLE from GateSeal
      const [, revokeCall] = await agentOrDirect(sealableContract, 'revokeRole', [pauseRoleHash, gateSealAddress]);
      calls.push(revokeCall);
      descriptions.push(`${step++}. Revoke PAUSE_ROLE from GateSeal ${gateSealAddress} on ${sealable}`);

      // Grant PAUSE_ROLE to CircuitBreaker
      const [, grantCall] = await agentOrDirect(sealableContract, 'grantRole', [pauseRoleHash, CIRCUIT_BREAKER]);
      calls.push(grantCall);
      descriptions.push(`${step++}. Grant PAUSE_ROLE to CircuitBreaker ${CIRCUIT_BREAKER} on ${sealable}`);

      // Register with CircuitBreaker
      const circuitBreakerContract = new Contract(CIRCUIT_BREAKER, circuitBreakerIface, provider);
      const [, registerCall] = await agentOrDirect(circuitBreakerContract, 'registerPauser', [sealable, sealingCommittee]);
      calls.push(registerCall);
      descriptions.push(
        `${step++}. Register ${sealable} with CircuitBreaker, pauser: ${sealingCommittee}`,
      );
    }
  }

  const description = descriptions.join('\n');

  logger.log('\nVote description:');
  logger.log(description);

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
