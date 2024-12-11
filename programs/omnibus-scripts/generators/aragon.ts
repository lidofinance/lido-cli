import { encodeCallScript, getRoleHash, logger } from '@utils';
import { confirmRoleGranting, printRoles } from './roles-auxiliary';
import { Contract } from 'ethers';
import { aclContract } from '@contracts';

export const encodeFromVotingGrantRolesAragonWithConfirm = async (
  contractName: string,
  rolesToGrant: string[],
  contract: Contract,
  rolesBeneficiary: string,
) => {
  printRoles(contractName, rolesToGrant);

  if (await confirmRoleGranting()) {
    logger.log();
    return await encodeFromVotingGrantRolesAragon(contractName, rolesToGrant, contract, rolesBeneficiary);
  }

  return [];
};

export const encodeFromVotingGrantRolesAragon = async (
  contractName: string,
  rolesToGrant: string[],
  contract: Contract,
  rolesBeneficiary: string,
) => {
  return await Promise.all(
    rolesToGrant.map(async (role) => {
      const [, grantRoleCall] = await encodeFromVotingGrantRoleAragon(contractName, contract, role, rolesBeneficiary);
      return grantRoleCall;
    }),
  );
};

export const encodeFromVotingGrantRoleAragon = async (
  contractName: string,
  contract: Contract,
  role: string,
  account: string,
) => {
  const roleHash = await getRoleHash(contract, role);
  const aclAddress = await aclContract.getAddress();
  const appAddress = await contract.getAddress();

  const grantPermissionCall = {
    to: aclAddress,
    data: aclContract.interface.encodeFunctionData('grantPermission', [account, appAddress, roleHash]),
    desc: `${contractName}: Grant '${role}' role to ${account}`,
  };

  const encoded = encodeCallScript([grantPermissionCall]);
  return [encoded, grantPermissionCall] as const;
};
