import {
  aragonAgentAddress,
  burnerAddress,
  burnerContract,
  consensusForCSMContract,
  getVersion,
  stakingRouterAddress,
  stakingRouterContract,
} from '@contracts';
import { provider } from '@providers';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, getRoleHash, getRoleHashByAddress } from '@utils';
import { Contract, Interface } from 'ethers';

import { encodeScriptsOracleMembers, getOracleMinQuorum } from './generators/oracles';

export const devnetCSMStart = async () => {
  const CS_MODULE_ADDRESS = process.env.CS_MODULE_ADDRESS as string;
  const CS_ACCOUNTING_ADDRESS = process.env.CS_ACCOUNTING_ADDRESS as string;
  const CS_ORACLE_HASH_CONSENSUS_ADDRESS = process.env.CS_ORACLE_HASH_CONSENSUS_ADDRESS as string;
  const CS_EJECTOR_ADDRESS = process.env.CS_EJECTOR_ADDRESS as string | undefined;
  const CS_TWG_ADDRESS = process.env.CS_TRIGGERABLE_WITHDRAWALS_GATEWAY_ADDRESS ?? process.env.CS_TWG_ADDRESS;

  const CS_MODULE_NAME = process.env.CS_MODULE_NAME ?? 'Community Staking';
  const CS_STAKE_SHARE_LIMIT = process.env.CS_STAKE_SHARE_LIMIT ?? 2000; // 20%
  const CS_PRIORITY_EXIT_SHARE_THRESHOLD = process.env.CS_PRIORITY_EXIT_SHARE_THRESHOLD ?? 2500; // 25%
  const CS_STAKING_MODULE_FEE = process.env.CS_STAKING_MODULE_FEE ?? 800; // 8%
  const CS_TREASURY_FEE = process.env.CS_TREASURY_FEE ?? 200; // 2%
  const CS_MAX_DEPOSITS_PER_BLOCK = process.env.CS_MAX_DEPOSITS_PER_BLOCK ?? 30;
  const CS_MIN_DEPOSIT_BLOCK_DISTANCE = process.env.CS_MIN_DEPOSIT_BLOCK_DISTANCE ?? 25;
  const CS_WITHDRAWAL_CREDENTIALS_TYPE = process.env.CS_WITHDRAWAL_CREDENTIALS_TYPE ?? 1;
  // 60 (50 + 10)
  // https://github.com/lidofinance/community-staking-module/blob/e1bbb4133d18206fc3a1a63ae660a670be08b6ea/script/DeployLocalDevNet.s.sol#L22
  const CS_ORACLE_INITIAL_EPOCH = process.env.CS_ORACLE_INITIAL_EPOCH ?? 60;

  const iface = new Interface([
    'function revokeRole(bytes32,address)',
    'function grantRole(bytes32,address)',
    'function RESUME_ROLE() view returns (bytes32)',
    'function MODULE_MANAGER_ROLE() view returns (bytes32)',
    'function resume()',
    'function activatePublicRelease()',
    'function updateInitialEpoch(uint256)',
    'function addStakingModule(string,address,(uint256,uint256,uint256,uint256,uint256,uint256,uint256))',
  ]);

  const csmVersion = await getVersion(provider, CS_MODULE_ADDRESS);

  /**
   * CSM
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
      [
        CS_STAKE_SHARE_LIMIT,
        CS_PRIORITY_EXIT_SHARE_THRESHOLD,
        CS_STAKING_MODULE_FEE,
        CS_TREASURY_FEE,
        CS_MAX_DEPOSITS_PER_BLOCK,
        CS_MIN_DEPOSIT_BLOCK_DISTANCE,
        CS_WITHDRAWAL_CREDENTIALS_TYPE,
      ],
    ]),
  });
  calls.push(addStakingModuleScript);

  if (csmVersion < 2) {
    items.push(
      `${itemIdx++}. Grant REQUEST_BURN_SHARES_ROLE role to CSAccounting contract with address ${CS_ACCOUNTING_ADDRESS}`,
    );
    const burnerRequestBurnRoleHash = await getRoleHash(burnerContract, 'REQUEST_BURN_SHARES_ROLE');
    const [, requestBurnRoleGrantScript] = encodeFromAgent({
      to: burnerAddress,
      data: iface.encodeFunctionData('grantRole', [burnerRequestBurnRoleHash, CS_ACCOUNTING_ADDRESS]),
    });
    calls.push(requestBurnRoleGrantScript);
  } else {
    items.push(
      `${itemIdx++}. Grant REQUEST_BURN_MY_STETH_ROLE role to CSAccounting contract with address ${CS_ACCOUNTING_ADDRESS}`,
    );
    const burnerRequestBurnRoleHash = await getRoleHash(burnerContract, 'REQUEST_BURN_MY_STETH_ROLE');
    const [, requestBurnRoleGrantScript] = encodeFromAgent({
      to: burnerAddress,
      data: iface.encodeFunctionData('grantRole', [burnerRequestBurnRoleHash, CS_ACCOUNTING_ADDRESS]),
    });
    calls.push(requestBurnRoleGrantScript);
  }

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
  const csModuleContract = new Contract(CS_MODULE_ADDRESS, iface, provider);
  const csmResumeRoleHash = await getRoleHash(csModuleContract, 'RESUME_ROLE');
  const [, resumeRoleGrantScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('grantRole', [csmResumeRoleHash, aragonAgentAddress]),
  });
  calls.push(resumeRoleGrantScript);

  if (csmVersion < 2) {
    items.push(`${itemIdx++}. Grant MODULE_MANAGER_ROLE role to agent ${aragonAgentAddress}`);
    const csmModuleManagerRoleHash = await getRoleHash(csModuleContract, 'MODULE_MANAGER_ROLE');
    const [, csmModuleManagerRoleGrantScript] = encodeFromAgent({
      to: CS_MODULE_ADDRESS,
      data: iface.encodeFunctionData('grantRole', [csmModuleManagerRoleHash, aragonAgentAddress]),
    });
    calls.push(csmModuleManagerRoleGrantScript);

    items.push(`${itemIdx++}. Activate public release`);
    const [, activatePublicReleaseScript] = encodeFromAgent({
      to: CS_MODULE_ADDRESS,
      data: iface.encodeFunctionData('activatePublicRelease', []),
    });
    calls.push(activatePublicReleaseScript);

    items.push(`${itemIdx++}. Revoke MODULE_MANAGER_ROLE role from agent ${aragonAgentAddress}`);
    const [, csmModuleManagerRoleRevokeScript] = encodeFromAgent({
      to: CS_MODULE_ADDRESS,
      data: iface.encodeFunctionData('revokeRole', [csmModuleManagerRoleHash, aragonAgentAddress]),
    });
    calls.push(csmModuleManagerRoleRevokeScript);
  }

  items.push(`${itemIdx++}. Resume staking module`);
  const [, resumeScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('resume', []),
  });
  calls.push(resumeScript);

  items.push(`${itemIdx++}. Revoke RESUME role from agent ${aragonAgentAddress}`);
  const [, resumeRoleRevokeScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('revokeRole', [csmResumeRoleHash, aragonAgentAddress]),
  });
  calls.push(resumeRoleRevokeScript);

  items.push(`${itemIdx++}. Update initial epoch to ${CS_ORACLE_INITIAL_EPOCH}`);
  const [, updateInitialEpochScript] = encodeFromAgent({
    to: CS_ORACLE_HASH_CONSENSUS_ADDRESS,
    data: iface.encodeFunctionData('updateInitialEpoch', [CS_ORACLE_INITIAL_EPOCH]),
  });
  calls.push(updateInitialEpochScript);

  // Register the perf-oracle members on the CSM HashConsensus (grant
  // MANAGE_MEMBERS_AND_QUORUM_ROLE from the Agent + addMember for each), bundled
  // into this same vote — mirrors how the Core devnet-start seeds the accounting
  // oracle. Without it the CSM HashConsensus stays empty and the perf-oracle
  // daemon crash-loops with IsNotMemberException. Skipped when CS_ORACLE_MEMBERS
  // is unset, so existing callers are unaffected.
  const CS_ORACLE_MEMBERS = (process.env.CS_ORACLE_MEMBERS ?? '')
    .split(',')
    .map((member) => member.trim())
    .filter(Boolean);
  if (CS_ORACLE_MEMBERS.length > 0) {
    const csOracleQuorum = process.env.CS_ORACLE_QUORUM
      ? Number(process.env.CS_ORACLE_QUORUM)
      : getOracleMinQuorum(CS_ORACLE_MEMBERS.length);
    const memberScripts = await encodeScriptsOracleMembers(
      'CS',
      consensusForCSMContract,
      CS_ORACLE_MEMBERS,
      csOracleQuorum,
    );
    for (const script of memberScripts) {
      items.push(`${itemIdx++}. ${script.desc}`);
      calls.push(script);
    }

    // SUBMIT_DATA_ROLE is NOT implied by consensus membership: the fee oracle gates
    // submitReportData on it separately, so without this the members reach quorum and
    // every data submission still reverts — consensus advances while
    // lastProcessingRefSlot stays frozen, which a pod-phase health check reads as green.
    // Observed on edf-devnet 2026-07-27: the role was missing for ALL members on BOTH
    // the CSM and the CMv2 fee oracle (6 grants), so do not assume CMv2 inherits it.
    // The oracle is the consensus contract's own reportProcessor, so no extra env var.
    const reportProcessorAddress: string = await consensusForCSMContract.getReportProcessor();
    const feeOracle = new Contract(
      reportProcessorAddress,
      [
        'function SUBMIT_DATA_ROLE() view returns (bytes32)',
        'function grantRole(bytes32,address)',
        'function hasRole(bytes32,address) view returns (bool)',
      ],
      provider,
    );
    const submitDataRole = await getRoleHash(feeOracle, 'SUBMIT_DATA_ROLE');
    for (const member of CS_ORACLE_MEMBERS) {
      if (await feeOracle.hasRole(submitDataRole, member)) continue; // idempotent
      items.push(`${itemIdx++}. Grant SUBMIT_DATA_ROLE to ${member} on oracle ${reportProcessorAddress}`);
      const [, grantSubmitDataScript] = encodeFromAgent({
        to: reportProcessorAddress,
        data: feeOracle.interface.encodeFunctionData('grantRole', [submitDataRole, member]),
      });
      calls.push(grantSubmitDataScript);
    }
  }

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, items.join('\n'));

  await forwardVoteFromTm(newVoteCalldata);
};
