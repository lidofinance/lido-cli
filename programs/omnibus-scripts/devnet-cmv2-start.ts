import {
  aragonAgentAddress,
  burnerAddress,
  burnerContract,
  stakingRouterAddress,
  stakingRouterContract,
} from '@contracts';
import { provider, wallet } from '@providers';
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
  const CS_WITHDRAWAL_CREDENTIALS_TYPE = process.env.CS_WITHDRAWAL_CREDENTIALS_TYPE ?? 1;
  // https://github.com/lidofinance/community-staking-module/blob/e1bbb4133d18206fc3a1a63ae660a670be08b6ea/script/DeployLocalDevNet.s.sol#L22
  const CS_ORACLE_INITIAL_EPOCH = process.env.CS_ORACLE_INITIAL_EPOCH ?? 60;

  const iface = new Interface([
    'function revokeRole(bytes32,address)',
    'function grantRole(bytes32,address)',
    'function RESUME_ROLE() view returns (bytes32)',
    'function isPaused() view returns (bool)',
    'function resume()',
    'function updateInitialEpoch(uint256)',
    'function addStakingModule(string,address,(uint256,uint256,uint256,uint256,uint256,uint256,uint256))',
  ]);

  const accessControlIface = new Interface([
    'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
    'function getRoleMember(bytes32,uint256) view returns (address)',
    'function hasRole(bytes32,address) view returns (bool)',
    'function grantRole(bytes32,address)',
  ]);

  /**
   * CMv2 (Curated Module v2)
   */

  const calls: CallScriptAction[] = [];
  const items: string[] = [];
  let itemIdx: number = 0;

  const modules = await stakingRouterContract.getStakingModules();
  const moduleExistsByAddress = modules.some(
    (m) => m.stakingModuleAddress.toLowerCase() === CS_MODULE_ADDRESS.toLowerCase(),
  );
  const moduleExistsByName = modules.some((m) => m.name === CS_MODULE_NAME);
  const moduleExists = moduleExistsByAddress || moduleExistsByName;
  console.log(
    '[cmv2] staking modules:',
    modules.length,
    'existsByAddress=',
    moduleExistsByAddress,
    'existsByName=',
    moduleExistsByName,
  );
  const cmv2ModuleContract = new Contract(CS_MODULE_ADDRESS, iface, provider);
  const modulePaused = await cmv2ModuleContract.isPaused();

  if (!moduleExists) {
    try {
      await stakingRouterContract.addStakingModule.staticCall(CS_MODULE_NAME, CS_MODULE_ADDRESS, [
        CS_STAKE_SHARE_LIMIT,
        CS_PRIORITY_EXIT_SHARE_THRESHOLD,
        CS_STAKING_MODULE_FEE,
        CS_TREASURY_FEE,
        CS_MAX_DEPOSITS_PER_BLOCK,
        CS_MIN_DEPOSIT_BLOCK_DISTANCE,
        CS_WITHDRAWAL_CREDENTIALS_TYPE,
      ]);
      await (
        await stakingRouterContract.addStakingModule(CS_MODULE_NAME, CS_MODULE_ADDRESS, [
          CS_STAKE_SHARE_LIMIT,
          CS_PRIORITY_EXIT_SHARE_THRESHOLD,
          CS_STAKING_MODULE_FEE,
          CS_TREASURY_FEE,
          CS_MAX_DEPOSITS_PER_BLOCK,
          CS_MIN_DEPOSIT_BLOCK_DISTANCE,
          CS_WITHDRAWAL_CREDENTIALS_TYPE,
        ])
      ).wait();
      console.log('[cmv2] addStakingModule executed directly by admin');
    } catch (e) {
      console.log('[cmv2] direct addStakingModule failed, will attempt via vote');
    }
  }

  const walletAddress = (await wallet.getAddress()).toLowerCase();

  const srModuleManageRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_MANAGE_ROLE');

  const stakingRouterAccessControl = new Contract(stakingRouterAddress, accessControlIface, wallet);
  const agentHasSrManageRole = await stakingRouterAccessControl.hasRole(srModuleManageRoleHash, aragonAgentAddress);

  const srAdminRole = await stakingRouterAccessControl.DEFAULT_ADMIN_ROLE();
  const srAdmin = (await stakingRouterAccessControl.getRoleMember(srAdminRole, 0)).toLowerCase();
  const agentHasSrAdminRole = await stakingRouterAccessControl.hasRole(srAdminRole, aragonAgentAddress);

  if (!agentHasSrAdminRole) {
    if (walletAddress != srAdmin) {
      throw new Error(
        `Wallet ${walletAddress} is not staking router admin ${srAdmin}. Cannot grant admin role to agent.`,
      );
    }

    await (await stakingRouterAccessControl.grantRole(srAdminRole, aragonAgentAddress)).wait();
  }

  if (!agentHasSrManageRole) {
    if (walletAddress != srAdmin) {
      throw new Error(
        `Wallet ${walletAddress} is not staking router admin ${srAdmin}. Cannot grant manage role to agent.`,
      );
    }

    await (await stakingRouterAccessControl.grantRole(srModuleManageRoleHash, aragonAgentAddress)).wait();
  }

  const burnerAdminRole = await burnerContract.DEFAULT_ADMIN_ROLE();
  const burnerAdmin = (await burnerContract.getRoleMember(burnerAdminRole, 0)).toLowerCase();
  const agentHasBurnerAdmin = await burnerContract.hasRole(burnerAdminRole, aragonAgentAddress);

  if (!agentHasBurnerAdmin) {
    if (walletAddress != burnerAdmin) {
      throw new Error(`Wallet ${walletAddress} is not burner admin ${burnerAdmin}. Cannot grant admin role to agent.`);
    }

    await (await burnerContract.grantRole(burnerAdminRole, aragonAgentAddress)).wait();
  }

  if (CS_TWG_ADDRESS) {
    const twgContract = new Contract(CS_TWG_ADDRESS, accessControlIface, wallet);
    const twgAdminRole = await twgContract.DEFAULT_ADMIN_ROLE();
    const twgAdmin = (await twgContract.getRoleMember(twgAdminRole, 0)).toLowerCase();
    const agentHasTwgAdmin = await twgContract.hasRole(twgAdminRole, aragonAgentAddress);

    if (!agentHasTwgAdmin) {
      if (walletAddress != twgAdmin) {
        throw new Error(`Wallet ${walletAddress} is not TWG admin ${twgAdmin}. Cannot grant admin role to agent.`);
      }

      await (await twgContract.grantRole(twgAdminRole, aragonAgentAddress)).wait();
    }
  }

  const hashConsensusAccessControl = new Contract(CS_ORACLE_HASH_CONSENSUS_ADDRESS, accessControlIface, wallet);
  const hcAdminRole = await hashConsensusAccessControl.DEFAULT_ADMIN_ROLE();
  const hcAdmin = (await hashConsensusAccessControl.getRoleMember(hcAdminRole, 0)).toLowerCase();
  const agentHasHcAdminRole = await hashConsensusAccessControl.hasRole(hcAdminRole, aragonAgentAddress);

  if (!agentHasHcAdminRole) {
    if (walletAddress != hcAdmin) {
      throw new Error(
        `Wallet ${walletAddress} is not hash consensus admin ${hcAdmin}. Cannot grant admin role to agent.`,
      );
    }

    await (await hashConsensusAccessControl.grantRole(hcAdminRole, aragonAgentAddress)).wait();
  }

  const cmv2ModuleAccessControl = new Contract(CS_MODULE_ADDRESS, accessControlIface, wallet);
  const cmv2ModuleAdminRole = await cmv2ModuleAccessControl.DEFAULT_ADMIN_ROLE();
  const cmv2ModuleAdmin = (await cmv2ModuleAccessControl.getRoleMember(cmv2ModuleAdminRole, 0)).toLowerCase();
  const agentHasCmv2ModuleAdmin = await cmv2ModuleAccessControl.hasRole(cmv2ModuleAdminRole, aragonAgentAddress);

  if (!agentHasCmv2ModuleAdmin) {
    if (walletAddress != cmv2ModuleAdmin) {
      throw new Error(
        `Wallet ${walletAddress} is not CMv2 module admin ${cmv2ModuleAdmin}. Cannot grant admin role to agent.`,
      );
    }

    await (await cmv2ModuleAccessControl.grantRole(cmv2ModuleAdminRole, aragonAgentAddress)).wait();
  }

  const cmv2AccountingAccessControl = new Contract(CS_ACCOUNTING_ADDRESS, accessControlIface, wallet);
  const cmv2AccountingAdminRole = await cmv2AccountingAccessControl.DEFAULT_ADMIN_ROLE();
  const cmv2AccountingAdmin = (
    await cmv2AccountingAccessControl.getRoleMember(cmv2AccountingAdminRole, 0)
  ).toLowerCase();
  const agentHasCmv2AccountingAdmin = await cmv2AccountingAccessControl.hasRole(
    cmv2AccountingAdminRole,
    aragonAgentAddress,
  );

  if (!agentHasCmv2AccountingAdmin) {
    if (walletAddress != cmv2AccountingAdmin) {
      throw new Error(
        `Wallet ${walletAddress} is not CMv2 accounting admin ${cmv2AccountingAdmin}. Cannot grant admin role to agent.`,
      );
    }

    await (await cmv2AccountingAccessControl.grantRole(cmv2AccountingAdminRole, aragonAgentAddress)).wait();
  }

  if (!agentHasSrManageRole) {
    items.push(`${itemIdx++}. Grant staking module manage role to agent ${aragonAgentAddress}`);
    const [, moduleManageRoleGrantToAgentScript] = encodeFromAgent({
      to: stakingRouterAddress,
      data: iface.encodeFunctionData('grantRole', [srModuleManageRoleHash, aragonAgentAddress]),
    });
    calls.push(moduleManageRoleGrantToAgentScript);
  }

  if (!moduleExists) {
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
  }

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

  if (modulePaused) {
    items.push(`${itemIdx++}. Grant RESUME role to agent ${aragonAgentAddress}`);
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
  }

  let canUpdateInitialEpoch = true;
  try {
    await cmv2ModuleContract.provider.call({
      to: CS_ORACLE_HASH_CONSENSUS_ADDRESS,
      from: aragonAgentAddress,
      data: iface.encodeFunctionData('updateInitialEpoch', [CS_ORACLE_INITIAL_EPOCH]),
    });
  } catch {
    canUpdateInitialEpoch = false;
  }

  if (canUpdateInitialEpoch) {
    items.push(`${itemIdx++}. Update initial epoch to ${CS_ORACLE_INITIAL_EPOCH}`);
    const [, updateInitialEpochScript] = encodeFromAgent({
      to: CS_ORACLE_HASH_CONSENSUS_ADDRESS,
      data: iface.encodeFunctionData('updateInitialEpoch', [CS_ORACLE_INITIAL_EPOCH]),
    });
    calls.push(updateInitialEpochScript);
  } else {
    console.log('[cmv2] Skipping updateInitialEpoch: call would revert');
  }

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, items.join('\n'));

  await forwardVoteFromTm(newVoteCalldata);
};
