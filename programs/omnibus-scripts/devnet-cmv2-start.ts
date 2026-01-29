import {
  aragonAgentAddress,
  burnerAddress,
  burnerContract,
  stakingRouterAddress,
  stakingRouterContract,
} from '@contracts';
import { provider } from '@providers';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, getRoleHash, getRoleHashByAddress } from '@utils';
import { Contract, Interface } from 'ethers';

export const devnetCMv2Start = async () => {
  const CS_MODULE_ADDRESS = process.env.CS_MODULE_ADDRESS as string;
  const CS_ACCOUNTING_ADDRESS = process.env.CS_ACCOUNTING_ADDRESS as string;
  const CS_ORACLE_HASH_CONSENSUS_ADDRESS = process.env.CS_ORACLE_HASH_CONSENSUS_ADDRESS as string;
  const CS_EJECTOR_ADDRESS = process.env.CS_EJECTOR_ADDRESS as string | undefined;
  const CS_TWG_ADDRESS = process.env.CS_TRIGGERABLE_WITHDRAWALS_GATEWAY_ADDRESS ?? process.env.CS_TWG_ADDRESS;

  const CS_MODULE_NAME = process.env.CS_MODULE_NAME ?? 'curated-onchain-v1';
  const CS_STAKE_SHARE_LIMIT = process.env.CS_STAKE_SHARE_LIMIT ?? 2000; // 20%
  const CS_PRIORITY_EXIT_SHARE_THRESHOLD = process.env.CS_PRIORITY_EXIT_SHARE_THRESHOLD ?? 2500; // 25%
  const CS_STAKING_MODULE_FEE = process.env.CS_STAKING_MODULE_FEE ?? 800; // 8%
  const CS_TREASURY_FEE = process.env.CS_TREASURY_FEE ?? 200; // 2%
  const CS_MAX_DEPOSITS_PER_BLOCK = process.env.CS_MAX_DEPOSITS_PER_BLOCK ?? 30;
  const CS_MIN_DEPOSIT_BLOCK_DISTANCE = process.env.CS_MIN_DEPOSIT_BLOCK_DISTANCE ?? 25;
  // https://github.com/lidofinance/community-staking-module/blob/e1bbb4133d18206fc3a1a63ae660a670be08b6ea/script/DeployLocalDevNet.s.sol#L22
  const CS_ORACLE_INITIAL_EPOCH = process.env.CS_ORACLE_INITIAL_EPOCH ?? 60;

  const iface = new Interface([
    'function revokeRole(bytes32,address)',
    'function grantRole(bytes32,address)',
    'function RESUME_ROLE() view returns (bytes32)',
    'function resume()',
    'function updateInitialEpoch(uint256)',
    'function addStakingModule(string,address,uint256,uint256,uint256,uint256,uint256,uint256)',
  ]);

  /**
   * CMv2 (Curated Module v2)
   */

  const calls: CallScriptAction[] = [];
  const items: string[] = [];
  let itemIdx: number = 0;

  items.push(`${itemIdx++}. Grant staking module manage role to agent ${aragonAgentAddress}`);
  const srModuleManageRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_MANAGE_ROLE');
  const [, moduleManageRoleGrantToAgentScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('grantRole', [srModuleManageRoleHash, aragonAgentAddress]),
  });
  calls.push(moduleManageRoleGrantToAgentScript);

  items.push(`${itemIdx++}. Add staking module ${CS_MODULE_NAME} with address ${CS_MODULE_ADDRESS}`);
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
  calls.push(addStakingModuleScript);

  items.push(
    `${itemIdx++}. Grant REQUEST_BURN_MY_STETH_ROLE role to Accounting contract with address ${CS_ACCOUNTING_ADDRESS}`,
  );
  const burnerRequestBurnRoleHash = await getRoleHash(burnerContract, 'REQUEST_BURN_MY_STETH_ROLE');
  const [, requestBurnRoleGrantScript] = encodeFromAgent({
    to: burnerAddress,
    data: iface.encodeFunctionData('grantRole', [burnerRequestBurnRoleHash, CS_ACCOUNTING_ADDRESS]),
  });
  calls.push(requestBurnRoleGrantScript);

  if (CS_TWG_ADDRESS && CS_EJECTOR_ADDRESS) {
    items.push(
      `${itemIdx++}. Grant ADD_FULL_WITHDRAWAL_REQUEST_ROLE role to Ejector contract with address ${CS_EJECTOR_ADDRESS}`,
    );
    const twgRoleHash = await getRoleHashByAddress(CS_TWG_ADDRESS, 'ADD_FULL_WITHDRAWAL_REQUEST_ROLE');
    const [, twgRoleGrantScript] = encodeFromAgent({
      to: CS_TWG_ADDRESS,
      data: iface.encodeFunctionData('grantRole', [twgRoleHash, CS_EJECTOR_ADDRESS]),
    });
    calls.push(twgRoleGrantScript);
  } else if (CS_TWG_ADDRESS || CS_EJECTOR_ADDRESS) {
    throw new Error('Both CS_TRIGGERABLE_WITHDRAWALS_GATEWAY_ADDRESS and CS_EJECTOR_ADDRESS are required');
  }

  items.push(`${itemIdx++}. Grant RESUME role to agent ${aragonAgentAddress}`);
  const cmv2ModuleContract = new Contract(CS_MODULE_ADDRESS, iface, provider);
  const resumeRoleHash = await getRoleHash(cmv2ModuleContract, 'RESUME_ROLE');
  const [, resumeRoleGrantScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('grantRole', [resumeRoleHash, aragonAgentAddress]),
  });
  calls.push(resumeRoleGrantScript);

  items.push(`${itemIdx++}. Resume staking module`);
  const [, resumeScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('resume', []),
  });
  calls.push(resumeScript);

  items.push(`${itemIdx++}. Revoke RESUME role from agent ${aragonAgentAddress}`);
  const [, resumeRoleRevokeScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('revokeRole', [resumeRoleHash, aragonAgentAddress]),
  });
  calls.push(resumeRoleRevokeScript);

  items.push(`${itemIdx++}. Update initial epoch to ${CS_ORACLE_INITIAL_EPOCH}`);
  const [, updateInitialEpochScript] = encodeFromAgent({
    to: CS_ORACLE_HASH_CONSENSUS_ADDRESS,
    data: iface.encodeFunctionData('updateInitialEpoch', [CS_ORACLE_INITIAL_EPOCH]),
  });
  calls.push(updateInitialEpochScript);

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, items.join('\n'));

  await forwardVoteFromTm(newVoteCalldata);
};
