import { encodeFromAgent } from '@scripts';
import { getRoleHash, logger } from '@utils';
import { Contract } from 'ethers';
import { confirmRoleGranting, printRoles } from './roles-auxiliary';

export const encodeFromAgentGrantRole = async (
  contractName: string,
  contract: Contract,
  role: string,
  account: string,
) => {
  const roleHash = await getRoleHash(contract, role);

  return encodeFromAgent({
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData('grantRole', [roleHash, account]),
    desc: `${contractName}: Grant "${role}" role to ${account}`,
  });
};

export const encodeFromAgentGrantRolesAccessControlWithConfirmed = async (
  contractName: string,
  rolesToGrant: string[],
  contract: Contract,
  rolesBeneficiary: string,
) => {
  printRoles(contractName, rolesToGrant);

  if (await confirmRoleGranting()) {
    logger.log();
    return await encodeFromAgentGrantRolesAccessControl(contractName, rolesToGrant, contract, rolesBeneficiary);
  }

  return [];
};

export const encodeFromAgentGrantRolesAccessControl = async (
  contractName: string,
  rolesToGrant: string[],
  contract: Contract,
  rolesBeneficiary: string,
) => {
  return await Promise.all(
    rolesToGrant.map(async (role) => {
      const [, grantRoleCall] = await encodeFromAgentGrantRole(contractName, contract, role, rolesBeneficiary);
      return grantRoleCall;
    }),
  );
};
