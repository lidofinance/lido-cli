import {
  accountingOracleAddress,
  aragonAgentAddress,
  burnerAddress,
  burnerContract,
  exitBusOracleAddress,
  exitBusOracleContract,
  getAppProxyContract,
  locatorContract,
  norAddress,
  stakingRouterAddress,
  stakingRouterContract,
} from '@contracts';
import { provider } from '@providers';
import { encodeFromAgent, updateAragonApp, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, getRoleHash } from '@utils';
import { Contract, Interface } from 'ethers';

// SR 2

const LOCATOR_IMPLEMENTAION = '0xcf720cb5635523ed1de57bb0d984445f6b7ca628';
const STAKING_ROUTER_IMPLEMENTATION = '0x43DAe324195BcCf10999673092522084Fc46116E';
const AO_IMPLEMENTATION = '0x382ec3b6471ca45821332c47a1740939a0ac4359';

const OLD_DSM = '0xE9c9FFcC3E837815C99bb661f147B337A8E0C79D';
const NEW_DSM = '0x9078C4e99A3b29f77164Da4892f68abA498cF5D9';

const NOR_IMPLEMENTATION = '0xcd4569620ac8c0eb8821d16c714c8b1a7b3f10a8';
const NOR_CONTENT_URI = '0x' + '00'.repeat(51);
const NOR_VERSION = ['2', '0', '0'];

const PRIORITY_EXIT_SHARE_THRESHOLDS_BP = [10_000];
const MAX_DEPOSITS_PER_BLOCK = [50];
const MIN_DEPOSIT_BLOCK_DISTANCES = [25];

const AO_CONSENSUS_VERSION = 2;
const VEBO_CONSENSUS_VERSION = 2;

// CSM

const CS_MODULE_ADDRESS = '0xb43fD1a6932345e5A0dc72a2b397c09f3390c1D0';
const CS_ACCOUNTING_ADDRESS = '0x9bd601f8b7A0F24fA58f6502EEC077Dc753476f6';
const CS_ORACLE_HASH_CONSENSUS_ADDRESS = '0xd2776403ADbc77958DD3DF490cDbCD2f4dFCf021';

const CS_MODULE_NAME = 'CommunityStaking';
const CS_STAKE_SHARE_LIMIT = 2000; // 20%
const CS_PRIORITY_EXIT_SHARE_THRESHOLD = 2500; // 25%
const CS_STAKING_MODULE_FEE = 800; // 8%
const CS_TREASURY_FEE = 200; // 2%
const CS_MAX_DEPOSITS_PER_BLOCK = 30;
const CS_MIN_DEPOSIT_BLOCK_DISTANCE = 25;

const CS_ORACLE_INITIAL_EPOCH = 57606; // 57600 for ao and vebo

export const stakingRouterV2 = async () => {
  const iface = new Interface([
    'function proxy__upgradeTo(address)',
    'function finalizeUpgrade_v2(uint256[],uint256[],uint256[])',
    'function finalizeUpgrade_v2(uint256)',
    'function finalizeUpgrade_v3()',
    'function revokeRole(bytes32,address)',
    'function grantRole(bytes32,address)',
    'function STAKING_MODULE_UNVETTING_ROLE() view returns (bytes32)',
    'function RESUME_ROLE() view returns (bytes32)',
    'function resume()',
    'function updateInitialEpoch(uint256)',
    'function addStakingModule(string,address,uint256,uint256,uint256,uint256,uint256,uint256)',
    'function setConsensusVersion(uint256)',
  ]);

  /**
   * SR 2
   */

  // 1. Update Locator implementation
  const locatorProxyAddress = await locatorContract.getAddress();
  const [, locatorUpgradeScript] = encodeFromAgent({
    to: locatorProxyAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [LOCATOR_IMPLEMENTAION]),
  });

  // 2. Revoke pause role from old DSM
  const srPauseRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_PAUSE_ROLE');
  const [, pauseRoleRevokeFromOldDSMScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('revokeRole', [srPauseRoleHash, OLD_DSM]),
  });

  // 3. Revoke resume role from old DSM
  const srResumeRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_RESUME_ROLE');
  const [, resumeRoleRevokeFromOldDSMScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('revokeRole', [srResumeRoleHash, OLD_DSM]),
  });

  // 4. Grant unvetting role to new DSM
  const stakingRouterImplContract = new Contract(STAKING_ROUTER_IMPLEMENTATION, iface, provider);
  const unvettingRoleHash = await getRoleHash(stakingRouterImplContract, 'STAKING_MODULE_UNVETTING_ROLE');
  const [, unvettingRoleGrantToDSMScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('grantRole', [unvettingRoleHash, NEW_DSM]),
  });

  // 5. Update SR implementation
  const [, stakingRouterUpdateScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [STAKING_ROUTER_IMPLEMENTATION]),
  });

  // 6. Call finalize upgrade on SR
  const stakingRouterFinalizeScript: CallScriptAction = {
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('finalizeUpgrade_v2(uint256[],uint256[],uint256[])', [
      PRIORITY_EXIT_SHARE_THRESHOLDS_BP,
      MAX_DEPOSITS_PER_BLOCK,
      MIN_DEPOSIT_BLOCK_DISTANCES,
    ]),
  };

  // 7, 8. Update NOR implementation
  const norProxyContract = getAppProxyContract(async () => norAddress);
  const norAppId = await norProxyContract.appId();
  const [, norNewVersionBumpScript, norSetAppScript] = await updateAragonApp(
    NOR_VERSION,
    NOR_IMPLEMENTATION,
    NOR_CONTENT_URI,
    norAppId,
  );

  // 9. Call finalize upgrade on NOR
  const norFinalizeScript: CallScriptAction = {
    to: norAddress,
    data: iface.encodeFunctionData('finalizeUpgrade_v3', []),
  };

  // 10. Update AO implementation
  const [, accountingOracleUpgradeScript] = encodeFromAgent({
    to: accountingOracleAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [AO_IMPLEMENTATION]),
  });

  // 11. Call finalize upgrade on AO
  const accountingOracleFinalizeScript: CallScriptAction = {
    to: accountingOracleAddress,
    data: iface.encodeFunctionData('finalizeUpgrade_v2(uint256)', [AO_CONSENSUS_VERSION]),
  };

  // 12. Grant manage consensus role to agent
  const manageConsensusRoleHash = await getRoleHash(exitBusOracleContract, 'MANAGE_CONSENSUS_VERSION_ROLE');
  const [, manageConsensusRoleGrantToAgentScript] = encodeFromAgent({
    to: exitBusOracleAddress,
    data: iface.encodeFunctionData('grantRole', [manageConsensusRoleHash, aragonAgentAddress]),
  });

  // 13. Update VEBO consensus version
  const [, exitBusOracleVersionScript] = encodeFromAgent({
    to: exitBusOracleAddress,
    data: iface.encodeFunctionData('setConsensusVersion', [VEBO_CONSENSUS_VERSION]),
  });

  /**
   * CSM
   */

  // 14. Grant staking module manage role to agent
  const srModuleManageRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_MANAGE_ROLE');
  const [, moduleManageRoleGrantToAgentScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('grantRole', [srModuleManageRoleHash, aragonAgentAddress]),
  });

  // 15. Add staking module
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

  // 16. Grant request burn role to CSAccounting contract
  const burnerRequestBurnRoleHash = await getRoleHash(burnerContract, 'REQUEST_BURN_SHARES_ROLE');
  const [, requestBurnRoleGrantScript] = encodeFromAgent({
    to: burnerAddress,
    data: iface.encodeFunctionData('grantRole', [burnerRequestBurnRoleHash, CS_ACCOUNTING_ADDRESS]),
  });

  // 17. Grant resume role to agent
  const csModuleContract = new Contract(CS_MODULE_ADDRESS, iface, provider);
  const csmResumeRoleHash = await getRoleHash(csModuleContract, 'RESUME_ROLE');
  const resumeRoleGrantScript: CallScriptAction = {
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('grantRole', [csmResumeRoleHash, aragonAgentAddress]),
  };

  // 18. Resume staking module
  const [, resumeScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('resume', []),
  });

  // 19. Revoke resume role from agent
  const resumeRoleRevokeScript: CallScriptAction = {
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('revokeRole', [csmResumeRoleHash, aragonAgentAddress]),
  };

  // 20. Update initial epoch
  const updateInitialEpochScript: CallScriptAction = {
    to: CS_ORACLE_HASH_CONSENSUS_ADDRESS,
    data: iface.encodeFunctionData('updateInitialEpoch', [CS_ORACLE_INITIAL_EPOCH]),
  };

  // TODO: easy track part of the script

  // Collect all calls
  const calls: CallScriptAction[] = [
    // SR
    locatorUpgradeScript,
    pauseRoleRevokeFromOldDSMScript,
    resumeRoleRevokeFromOldDSMScript,
    unvettingRoleGrantToDSMScript,
    stakingRouterUpdateScript,
    stakingRouterFinalizeScript,
    norNewVersionBumpScript,
    norSetAppScript,
    norFinalizeScript,
    accountingOracleUpgradeScript,
    accountingOracleFinalizeScript,
    manageConsensusRoleGrantToAgentScript,
    exitBusOracleVersionScript,

    // CSM
    moduleManageRoleGrantToAgentScript,
    addStakingModuleScript,
    requestBurnRoleGrantScript,
    resumeRoleGrantScript,
    resumeScript,
    resumeRoleRevokeScript,
    updateInitialEpochScript,
  ];

  const description = [
    // SR
    `1. Update locator implementation to ${LOCATOR_IMPLEMENTAION} with new DSM and Sanity Checker`,
    `2. Revoke pause role from old DSM ${OLD_DSM}`,
    `3. Revoke resume role from old DSM ${OLD_DSM}`,
    `4. Grant unvetting role to new DSM ${NEW_DSM}`,
    `5. Update SR implementation to ${STAKING_ROUTER_IMPLEMENTATION}`,
    `6. Finalize SR upgrade`,
    `7. Create new NOR version with address ${NOR_IMPLEMENTATION}`,
    `8. Update NOR app to new version`,
    `9. Finalize NOR upgrade`,
    `10. Update AO implementation to ${AO_IMPLEMENTATION}`,
    `11. Finalize AO upgrade and set consensus version to ${AO_CONSENSUS_VERSION}`,
    `12. Update VEBO consensus version to ${VEBO_CONSENSUS_VERSION}`,
    `13. Grant manage consensus role to agent ${aragonAgentAddress}`,

    // CSM
    `14. Grant staking module manage role to agent ${aragonAgentAddress}`,
    `15. Add staking module ${CS_MODULE_NAME} with address ${CS_MODULE_ADDRESS}`,
    `16. Grant request burn shares role to CSAccounting contract with address ${CS_ACCOUNTING_ADDRESS}`,
    `17. Grant resume role to agent ${aragonAgentAddress}`,
    `18. Resume staking module`,
    `19. Revoke resume role from agent ${aragonAgentAddress}`,
    `20. Update initial epoch to ${CS_ORACLE_INITIAL_EPOCH}`,
    // TODO: easy track part of the script
  ].join('\n');

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
