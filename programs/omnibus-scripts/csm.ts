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

const CS_MODULE_ADDRESS = '0xddB08564C699D5392a9E9a3C8E2Ab9D7C1949CB6';
const CS_ACCOUNTING_ADDRESS = '0x9808a94167b30c2F71d2863dbdB8eD9B65ED1DBe';
const CSM_ORACLE_HASH_CONSENSUS_ADDRESS = '0x8e1249fA85dfe4d6ecdCD56230F9c81Ede6D354a';

const MODULE_NAME = 'CommunityStaking';
const STAKE_SHARE_LIMIT = 2000; // 20%
const PRIORITY_EXIT_SHARE_THRESHOLD = 2500; // 25%
const STAKING_MODULE_FEE = 800; // 8%
const TREASURY_FEE = 200; // 2%
const MAX_DEPOSITS_PER_BLOCK = 30;
const MIN_DEPOSIT_BLOCK_DISTANCE = 25;

const CSM_ORACLE_INITIAL_EPOCH = 47475;

export const CSM = async () => {
  const iface = new Interface([
    'function addStakingModule(string,address,uint256,uint256,uint256,uint256,uint256,uint256)',
    'function grantRole(bytes32,address)',
    'function revokeRole(bytes32,address)',
    'function RESUME_ROLE() view returns (bytes32)',
    'function resume()',
    'function updateInitialEpoch(uint256)',
  ]);

  // 1. Grant staking module manage role to agent
  const moduleManageRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_MANAGE_ROLE');
  const [, moduleManageRoleGrantScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('grantRole', [moduleManageRoleHash, aragonAgentAddress]),
  });

  // 2. Add staking module
  const [, addModuleScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('addStakingModule', [
      MODULE_NAME,
      CS_MODULE_ADDRESS,
      STAKE_SHARE_LIMIT,
      PRIORITY_EXIT_SHARE_THRESHOLD,
      STAKING_MODULE_FEE,
      TREASURY_FEE,
      MAX_DEPOSITS_PER_BLOCK,
      MIN_DEPOSIT_BLOCK_DISTANCE,
    ]),
  });

  // 3. Grant request burn role to CSAccounting contract
  const requestBurnRoleHash = await getRoleHash(burnerContract, 'REQUEST_BURN_SHARES_ROLE');
  const [, requestBurnRoleGrantScript] = encodeFromAgent({
    to: burnerAddress,
    data: iface.encodeFunctionData('grantRole', [requestBurnRoleHash, CS_ACCOUNTING_ADDRESS]),
  });

  // 4. Grant resume role to agent
  const contract = new Contract(CS_MODULE_ADDRESS, iface, provider);
  const resumeRoleHash = await getRoleHash(contract, 'RESUME_ROLE');
  const resumeRoleGrantScript: CallScriptAction = {
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('grantRole', [resumeRoleHash, aragonAgentAddress]),
  };

  // 5. Resume staking module
  const [, resumeScript] = encodeFromAgent({
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('resume', []),
  });

  // 6. Revoke resume role from agent
  const resumeRoleRevokeScript: CallScriptAction = {
    to: CS_MODULE_ADDRESS,
    data: iface.encodeFunctionData('revokeRole', [resumeRoleHash, aragonAgentAddress]),
  };

  // 7. Update initial epoch
  const updateInitialEpochScript: CallScriptAction = {
    to: CSM_ORACLE_HASH_CONSENSUS_ADDRESS,
    data: iface.encodeFunctionData('updateInitialEpoch', [CSM_ORACLE_INITIAL_EPOCH]),
  };

  // Collect all calls
  const calls: CallScriptAction[] = [
    moduleManageRoleGrantScript,
    addModuleScript,
    requestBurnRoleGrantScript,
    resumeRoleGrantScript,
    resumeScript,
    resumeRoleRevokeScript,
    updateInitialEpochScript,
  ];

  const description = [
    `1. Grant staking module manage role to agent`,
    `2. Add CSM with address ${CS_MODULE_ADDRESS} to the staking router`,
    `3. Grant request burn shares role CSAccounting contract with address ${CS_ACCOUNTING_ADDRESS}`,
    `4. Grant resume role to agent`,
    `5. Resume CSModule`,
    `6. Revoke resume role from agent`,
    `7. Update initial epoch of CSM Oracle to ${CSM_ORACLE_INITIAL_EPOCH}`,
  ].join('\n');

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
