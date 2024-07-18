import {
  csAccountingAddress,
  csFeeDistributorAddress,
  csFeeOracleAddress,
  csModuleAddress,
  csModuleContract,
} from '@contracts';

import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptActionWithDescription, encodeCallScript, forwardVoteFromTm } from '@utils';
import { Interface } from 'ethers';
import { joinVotingDesc } from './generators';

const CSM_NEW_IMPLEMENTATION = '0x51Fc9ee9a5f6BF0486Ca4FB425ced0E4C045163d';
const ACCOUNTING_NEW_IMPLEMENTATION = '0x42b2a5E3846a0dA63EF10D81fDD5A3B4574DC451';
const FEE_DISTRIBUTOR_NEW_IMPLEMENTATION = '0x20715dF9e40226285eba43980576a02B1Eedf6B9';
const FEE_ORACLE_NEW_IMPLEMENTATION = '0x42d1Fd3f49Aebd0cC8991b20067f0ae1FED531A8';

const NEW_VERIFIER = '0xeaba76faf7a5473fac6a2511d8115beab43cf8a7';
const OLD_VERIFIER = '0x6dca479178e6ae41cceb72a88ffdaa3e10e83cb7';

export const csmUpdate = async () => {
  const iface = new Interface([
    'function proxy__upgradeTo(address)',
    'function grantRole(bytes32,address)',
    'function revokeRole(bytes32,address)',
  ]);

  // Update module implementation
  const [, csModuleUpgradeScript] = encodeFromAgent({
    to: csModuleAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [CSM_NEW_IMPLEMENTATION]),
    desc: `Update CSM implementation to ${CSM_NEW_IMPLEMENTATION}`,
  });

  // Update accounting implementation
  const [, csAccountingUpgradeScript] = encodeFromAgent({
    to: csAccountingAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [ACCOUNTING_NEW_IMPLEMENTATION]),
    desc: `Update accounting implementation to ${ACCOUNTING_NEW_IMPLEMENTATION}`,
  });

  // Update fee distributor implementation
  const [, csFeeDistributorUpgradeScript] = encodeFromAgent({
    to: csFeeDistributorAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [FEE_DISTRIBUTOR_NEW_IMPLEMENTATION]),
    desc: `Update fee distributor implementation to ${FEE_DISTRIBUTOR_NEW_IMPLEMENTATION}`,
  });

  // Update fee oracle implementation
  const [, csFeeOracleUpgradeScript] = encodeFromAgent({
    to: csFeeOracleAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [FEE_ORACLE_NEW_IMPLEMENTATION]),
    desc: `Update fee oracle implementation to ${FEE_ORACLE_NEW_IMPLEMENTATION}`,
  });

  const verifierRole = await csModuleContract.VERIFIER_ROLE();

  // Grant role to new verifier
  const [, grantVerifierRoleScript] = encodeFromAgent({
    to: csModuleAddress,
    data: iface.encodeFunctionData('grantRole', [verifierRole, NEW_VERIFIER]),
    desc: `Grant verifier role to ${NEW_VERIFIER}`,
  });

  // Revoke role from old verifier
  const [, revokeVerifierRoleScript] = encodeFromAgent({
    to: csModuleAddress,
    data: iface.encodeFunctionData('grantRole', [verifierRole, NEW_VERIFIER]),
    desc: `Revoke verifier role from ${OLD_VERIFIER}`,
  });

  const votingCalls: CallScriptActionWithDescription[] = [
    csModuleUpgradeScript,
    csAccountingUpgradeScript,
    csFeeDistributorUpgradeScript,
    csFeeOracleUpgradeScript,
    grantVerifierRoleScript,
    revokeVerifierRoleScript,
  ];
  const description = joinVotingDesc(votingCalls);

  const voteEvmScript = encodeCallScript(votingCalls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
