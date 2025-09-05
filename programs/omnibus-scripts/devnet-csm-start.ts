import {
  aragonAgentAddress,
  burnerAddress,
  burnerContract,
  stakingRouterAddress,
  stakingRouterContract,
} from '@contracts';
import { provider } from '@providers';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, getRoleHash } from '@utils';
import { Contract, Interface } from 'ethers';

export const devnetCSMStart = async () => {
  const CS_MODULE_ADDRESS = process.env.CS_MODULE_ADDRESS as string;
  const CS_ACCOUNTING_ADDRESS = process.env.CS_ACCOUNTING_ADDRESS as string;
  const CS_ORACLE_HASH_CONSENSUS_ADDRESS = process.env.CS_ORACLE_HASH_CONSENSUS_ADDRESS as string;

  const CS_MODULE_NAME = process.env.CS_MODULE_NAME ?? 'CommunityStaking';
  const CS_STAKE_SHARE_LIMIT = process.env.CS_STAKE_SHARE_LIMIT ?? 2000; // 20%
  const CS_PRIORITY_EXIT_SHARE_THRESHOLD = process.env.CS_PRIORITY_EXIT_SHARE_THRESHOLD ?? 2500; // 25%
  const CS_STAKING_MODULE_FEE = process.env.CS_STAKING_MODULE_FEE ?? 800; // 8%
  const CS_TREASURY_FEE = process.env.CS_TREASURY_FEE ?? 200; // 2%
  const CS_MAX_DEPOSITS_PER_BLOCK = process.env.CS_MAX_DEPOSITS_PER_BLOCK ?? 30;
  const CS_MIN_DEPOSIT_BLOCK_DISTANCE = process.env.CS_MIN_DEPOSIT_BLOCK_DISTANCE ?? 25;
  // 60 (50 + 10)
  // https://github.com/lidofinance/community-staking-module/blob/e1bbb4133d18206fc3a1a63ae660a670be08b6ea/script/DeployLocalDevNet.s.sol#L22
  const CS_ORACLE_INITIAL_EPOCH = process.env.CS_ORACLE_INITIAL_EPOCH ?? 60;

  const iface = new Interface([
    'function proxy__upgradeTo(address)',
    'function finalizeUpgrade_v2(uint256[],uint256[],uint256[])',
    'function finalizeUpgrade_v2(uint256)',
    'function finalizeUpgrade_v3()',
    'function revokeRole(bytes32,address)',
    'function grantRole(bytes32,address)',
    'function STAKING_MODULE_UNVETTING_ROLE() view returns (bytes32)',
    'function RESUME_ROLE() view returns (bytes32)',
    'function MODULE_MANAGER_ROLE() view returns (bytes32)',
    'function resume()',
    'function activatePublicRelease()',
    'function updateInitialEpoch(uint256)',
    'function addStakingModule(string,address,uint256,uint256,uint256,uint256,uint256,uint256)',
    'function setConsensusVersion(uint256)',
    'function addEVMScriptFactory(address,bytes)',
  ]);

  /**
   * CSM
   */

  // 1. Grant staking module manage role to agent
  const srModuleManageRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_MANAGE_ROLE');
  const [, moduleManageRoleGrantToAgentScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('grantRole', [srModuleManageRoleHash, aragonAgentAddress]),
  });

  // 2. Add staking module
  const [, addStakingModuleScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('addStakingModule', [
      CS_MODULE_NAME,
      CS_MODULE_ADDRESS,
      CS_STAKE_SHARE_LIMIT,
      CS_PRIORITY_EXIT_SHARE_THRESHOLD,
      CS_STAKING_MODULE_FEE,
      CS_TREASURY_FEE,
      CS_MAX_DEPOSITS_PER_BLOCK,
      CS_MIN_DEPOSIT_BLOCK_DISTANCE,
    ]),
  });

  // 3. Grant request burn role to CSAccounting contract
  const burnerRequestBurnRoleHash = await getRoleHash(burnerContract, 'REQUEST_BURN_SHARES_ROLE');
  const [, requestBurnRoleGrantScript] = encodeFromAgent({
    to: burnerAddress,
    data: iface.encodeFunctionData('grantRole', [burnerRequestBurnRoleHash, CS_ACCOUNTING_ADDRESS]),
  });

  // 4. Grant resume role to agent
  const csModuleContract = new Contract(CS_MODULE_ADDRESS, iface, provider);
  const csmResumeRoleHash = await getRoleHash(csModuleContract, 'RESUME_ROLE');
  const [, resumeRoleGrantScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('grantRole', [csmResumeRoleHash, aragonAgentAddress]),
  });

  // // 5. Grant csmModuleManager role to agent
  // const csmModuleManagerRoleHash = await getRoleHash(csModuleContract, 'MODULE_MANAGER_ROLE');
  // const [, csmModuleManagerRoleGrantScript] = encodeFromAgent({
  //   to: CS_MODULE_ADDRESS,
  //   data: iface.encodeFunctionData('grantRole', [csmModuleManagerRoleHash, aragonAgentAddress]),
  // });

  // 6. Resume staking module
  const [, resumeScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('resume', []),
  });

  // 7. Activate public release
  // const [, activatePublicReleaseScript] = encodeFromAgent({
  //   to: CS_MODULE_ADDRESS,
  //   data: iface.encodeFunctionData('activatePublicRelease', []),
  // });

  // 8. Revoke resume role from agent
  const [, resumeRoleRevokeScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('revokeRole', [csmResumeRoleHash, aragonAgentAddress]),
  });

  // // 9. Revoke csmModuleManager role from agent
  // const [, resumeCsmModuleManagerRoleRevokeScript] = encodeFromAgent({
  //   to: CS_MODULE_ADDRESS,
  //   data: iface.encodeFunctionData('revokeRole', [csmModuleManagerRoleHash, aragonAgentAddress]),
  // });

  // 10. Update initial epoch
  const [, updateInitialEpochScript] = encodeFromAgent({
    to: CS_ORACLE_HASH_CONSENSUS_ADDRESS,
    data: iface.encodeFunctionData('updateInitialEpoch', [CS_ORACLE_INITIAL_EPOCH]),
  });

  // Collect all calls
  const calls: CallScriptAction[] = [
    moduleManageRoleGrantToAgentScript,
    addStakingModuleScript,
    requestBurnRoleGrantScript,
    resumeRoleGrantScript,
    // csmModuleManagerRoleGrantScript,
    resumeScript,
    // activatePublicReleaseScript,
    resumeRoleRevokeScript,
    // resumeCsmModuleManagerRoleRevokeScript,
    updateInitialEpochScript,
  ];

  const description = [
    `1. Grant staking module manage role to agent ${aragonAgentAddress}`,
    `2. Add staking module ${CS_MODULE_NAME} with address ${CS_MODULE_ADDRESS}`,
    `3. Grant request burn shares role to CSAccounting contract with address ${CS_ACCOUNTING_ADDRESS}`,
    `4. Grant resume role to agent ${aragonAgentAddress}`,
    // `5. Grant csmModuleManager role to agent ${aragonAgentAddress}`,
    `6. Resume staking module`,
    // `7. Activate public release`,
    `8. Revoke resume role from agent ${aragonAgentAddress}`,
    // `9. Revoke csmModuleManager role from agent ${aragonAgentAddress}`,
    `10. Update initial epoch to ${CS_ORACLE_INITIAL_EPOCH}`,
  ].join('\n');

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
