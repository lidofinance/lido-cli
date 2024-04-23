import {
  aragonAgentAddress,
  burnerAddress,
  burnerContract,
  stakingRouterAddress,
  stakingRouterContract,
} from '@contracts';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, getRoleHash } from '@utils';
import { Interface } from 'ethers';

const CS_MODULE_ADDRESS = '0xceEE0fA590c7eA0d3c0bf61fD0228eC2d935d282';
const CS_ACCOUNTING_ADDRESS = '0xBEbca4004679eA617bf955c9f007BC413Cf5b932';

const MODULE_NAME = 'CommunityStaking';
const STAKE_SHARE_LIMIT = 2000; // 20%
const PRIORITY_EXIT_SHARE_THRESHOLD = 2500; // 25%
const STAKING_MODULE_FEE = 800; // 8%
const TREASURY_FEE = 200; // 2%
const MAX_DEPOSITS_PER_BLOCK = 30;
const MIN_DEPOSIT_BLOCK_DISTANCE = 25;

export const CSM = async () => {
  const iface = new Interface([
    'function addStakingModule(string,address,uint256,uint256,uint256,uint256,uint256,uint256)',
    'function grantRole(bytes32,address)',
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

  // Collect all calls
  const calls: CallScriptAction[] = [moduleManageRoleGrantScript, addModuleScript, requestBurnRoleGrantScript];

  const description = [
    `1. Grant staking module manage role to agent`,
    `2. Add Community Staking Module with address (${CS_MODULE_ADDRESS}) to the staking router`,
    `3. Grant request burn shares role CSAccounting contract with address ${CS_ACCOUNTING_ADDRESS}`,
  ].join('\n');

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
