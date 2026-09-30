import {
  aragonAgentAddress,
  burnerAddress,
  burnerContract,
  stakingRouterAddress,
  stakingRouterContract,
} from '@contracts';
import { provider, wallet } from '@providers';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, forwardVoteFromTmDG, getRoleHash, getRoleHashByAddress } from '@utils';
import { Contract, Interface, id } from 'ethers';

export const devnetCMv2Start = async () => {
  const CS_MODULE_ADDRESS = process.env.CS_MODULE_ADDRESS as string;
  const CS_ACCOUNTING_ADDRESS = process.env.CS_ACCOUNTING_ADDRESS as string;
  const CS_ORACLE_HASH_CONSENSUS_ADDRESS = process.env.CS_ORACLE_HASH_CONSENSUS_ADDRESS as string;
  const CS_EJECTOR_ADDRESS = process.env.CS_EJECTOR_ADDRESS as string | undefined;
  const CS_TWG_ADDRESS = process.env.CS_TRIGGERABLE_WITHDRAWALS_GATEWAY_ADDRESS ?? process.env.CS_TWG_ADDRESS;
  const CS_VETTED_GATE_ADDRESS = process.env.CS_PERMISSIONLESS_GATE_ADDRESS ?? process.env.CS_VETTED_GATE_ADDRESS;
  const CS_VETTED_GATE_SET_TREE_ROLE_GRANTEE = process.env.CS_VETTED_GATE_SET_TREE_ROLE_GRANTEE ?? aragonAgentAddress;

  const CS_MODULE_NAME = process.env.CS_MODULE_NAME ?? 'curated-onchain-v2';
  const CS_STAKE_SHARE_LIMIT = process.env.CS_STAKE_SHARE_LIMIT ?? 2000; // 20%
  const CS_PRIORITY_EXIT_SHARE_THRESHOLD = process.env.CS_PRIORITY_EXIT_SHARE_THRESHOLD ?? 2500; // 25%
  const CS_STAKING_MODULE_FEE = process.env.CS_STAKING_MODULE_FEE ?? 800; // 8%
  const CS_TREASURY_FEE = process.env.CS_TREASURY_FEE ?? 200; // 2%
  const CS_MAX_DEPOSITS_PER_BLOCK = process.env.CS_MAX_DEPOSITS_PER_BLOCK ?? 30;
  const CS_MIN_DEPOSIT_BLOCK_DISTANCE = process.env.CS_MIN_DEPOSIT_BLOCK_DISTANCE ?? 25;
  const CS_WITHDRAWAL_CREDENTIALS_TYPE = 2;
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
    'function META_REGISTRY() view returns (address)',
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
  const CS_META_REGISTRY_ROLE_GRANTEE = process.env.CS_META_REGISTRY_ROLE_GRANTEE ?? wallet.address;

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

  const metaRegistryAddress = await cmv2ModuleContract.META_REGISTRY();
  if (metaRegistryAddress && metaRegistryAddress !== '0x0000000000000000000000000000000000000000') {
    const metaRegistryAccessControl = new Contract(metaRegistryAddress, accessControlIface, wallet);
    const metaRegistryAdminRole = await metaRegistryAccessControl.DEFAULT_ADMIN_ROLE();
    const metaRegistryAdmin = (await metaRegistryAccessControl.getRoleMember(metaRegistryAdminRole, 0)).toLowerCase();
    const hasManageOperatorGroupsRole = await metaRegistryAccessControl.hasRole(
      await getRoleHashByAddress(metaRegistryAddress, 'MANAGE_OPERATOR_GROUPS_ROLE'),
      CS_META_REGISTRY_ROLE_GRANTEE,
    );

    if (!hasManageOperatorGroupsRole) {
      if (walletAddress != metaRegistryAdmin) {
        console.log(
          `[cmv2] Wallet ${walletAddress} is not MetaRegistry admin ${metaRegistryAdmin}; skipping direct MANAGE_OPERATOR_GROUPS_ROLE grant and relying on the follow-up vote flow`,
        );
      } else {
        await (
          await metaRegistryAccessControl.grantRole(
            await getRoleHashByAddress(metaRegistryAddress, 'MANAGE_OPERATOR_GROUPS_ROLE'),
            CS_META_REGISTRY_ROLE_GRANTEE,
          )
        ).wait();
      }
    }
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

  if (CS_VETTED_GATE_ADDRESS) {
    const vettedGateAccessControl = new Contract(CS_VETTED_GATE_ADDRESS, accessControlIface, wallet);
    const vettedGateAdminRole = await vettedGateAccessControl.DEFAULT_ADMIN_ROLE();
    const vettedGateAdmin = (await vettedGateAccessControl.getRoleMember(vettedGateAdminRole, 0)).toLowerCase();
    const agentHasVettedGateAdminRole = await vettedGateAccessControl.hasRole(vettedGateAdminRole, aragonAgentAddress);

    if (!agentHasVettedGateAdminRole) {
      if (walletAddress != vettedGateAdmin) {
        throw new Error(
          `Wallet ${walletAddress} is not CMv2 vetted gate admin ${vettedGateAdmin}. Cannot grant admin role to agent.`,
        );
      }

      await (await vettedGateAccessControl.grantRole(vettedGateAdminRole, aragonAgentAddress)).wait();
    }

    const setTreeRoleHash = await getRoleHashByAddress(CS_VETTED_GATE_ADDRESS, 'SET_TREE_ROLE');
    const agentHasSetTreeRole = await vettedGateAccessControl.hasRole(setTreeRoleHash, aragonAgentAddress);

    if (!agentHasSetTreeRole) {
      if (walletAddress != vettedGateAdmin) {
        throw new Error(
          `Wallet ${walletAddress} is not CMv2 vetted gate admin ${vettedGateAdmin}. Cannot grant SET_TREE_ROLE to agent.`,
        );
      }

      await (await vettedGateAccessControl.grantRole(setTreeRoleHash, aragonAgentAddress)).wait();
    }
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
    let canAddModule = true;
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
    } catch {
      canAddModule = false;
      console.log('[cmv2] Skipping addStakingModule in vote: call would revert');
    }

    if (canAddModule) {
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
  }

  if (CS_VETTED_GATE_ADDRESS) {
    const setTreeRoleHash = await getRoleHashByAddress(CS_VETTED_GATE_ADDRESS, 'SET_TREE_ROLE');
    const vettedGateAccessControl = new Contract(CS_VETTED_GATE_ADDRESS, accessControlIface, wallet);
    const granteeHasSetTreeRole = await vettedGateAccessControl.hasRole(
      setTreeRoleHash,
      CS_VETTED_GATE_SET_TREE_ROLE_GRANTEE,
    );

    if (!granteeHasSetTreeRole) {
      items.push(
        `${itemIdx++}. Grant SET_TREE_ROLE to ${CS_VETTED_GATE_SET_TREE_ROLE_GRANTEE} on vetted gate ${CS_VETTED_GATE_ADDRESS}`,
      );
      const [, grantSetTreeRoleScript] = encodeFromAgent({
        to: CS_VETTED_GATE_ADDRESS,
        data: iface.encodeFunctionData('grantRole', [setTreeRoleHash, CS_VETTED_GATE_SET_TREE_ROLE_GRANTEE]),
      });
      calls.push(grantSetTreeRoleScript);
    }
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

  items.push(`${itemIdx++}. Update initial epoch to ${CS_ORACLE_INITIAL_EPOCH}`);
  const [, updateInitialEpochScript] = encodeFromAgent({
    to: CS_ORACLE_HASH_CONSENSUS_ADDRESS,
    data: iface.encodeFunctionData('updateInitialEpoch', [CS_ORACLE_INITIAL_EPOCH]),
  });
  calls.push(updateInitialEpochScript);

  // Append role grants previously executed by separate `cmv2 grant-*-role-vote`
  // commands. Bundling them into the omnibus means a single DG cycle covers
  // the full CMv2 activation and the follow-up `cmv2 set-default-keys-limit`
  // direct tx finds MANAGE_KEYS_LIMIT_ROLE already granted.

  const grantRoleIface = new Interface(['function grantRole(bytes32,address)']);
  const accessControlGrantRoleData = (role: string, account: string) =>
    grantRoleIface.encodeFunctionData('grantRole', [role, account]);

  const metaRegistryAddressForGrant = await cmv2ModuleContract.META_REGISTRY();
  if (metaRegistryAddressForGrant && metaRegistryAddressForGrant !== '0x0000000000000000000000000000000000000000') {
    const manageOperatorGroupsRole = id('MANAGE_OPERATOR_GROUPS_ROLE');
    items.push(
      `${itemIdx++}. Grant MANAGE_OPERATOR_GROUPS_ROLE to ${CS_META_REGISTRY_ROLE_GRANTEE} on MetaRegistry ${metaRegistryAddressForGrant}`,
    );
    const [, grantManageOperatorGroupsScript] = encodeFromAgent({
      to: metaRegistryAddressForGrant,
      data: accessControlGrantRoleData(manageOperatorGroupsRole, CS_META_REGISTRY_ROLE_GRANTEE),
    });
    calls.push(grantManageOperatorGroupsScript);
  }

  const parametersRegistryAddress: string = await cmv2ModuleContract.PARAMETERS_REGISTRY().catch(() => '');
  if (parametersRegistryAddress && parametersRegistryAddress !== '0x0000000000000000000000000000000000000000') {
    const parametersRegistryReadonly = new Contract(
      parametersRegistryAddress,
      ['function MANAGE_KEYS_LIMIT_ROLE() view returns (bytes32)'],
      provider,
    );
    let manageKeysLimitRole: string;
    try {
      manageKeysLimitRole = await parametersRegistryReadonly.MANAGE_KEYS_LIMIT_ROLE();
    } catch {
      manageKeysLimitRole = id('MANAGE_KEYS_LIMIT_ROLE');
    }
    items.push(
      `${itemIdx++}. Grant MANAGE_KEYS_LIMIT_ROLE to ${walletAddress} on ParametersRegistry ${parametersRegistryAddress}`,
    );
    const [, grantManageKeysLimitScript] = encodeFromAgent({
      to: parametersRegistryAddress,
      data: accessControlGrantRoleData(manageKeysLimitRole, walletAddress),
    });
    calls.push(grantManageKeysLimitScript);
  }

  if (process.env.USE_DG === '1') {
    await forwardVoteFromTmDG(calls, items.join('\n'));
  } else {
    const voteEvmScript = encodeCallScript(calls);
    const [newVoteCalldata] = votingNewVote(voteEvmScript, items.join('\n'));
    await forwardVoteFromTm(newVoteCalldata);
  }
};
