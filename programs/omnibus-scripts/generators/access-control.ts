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
  console.log('>>>>>> ac0');
  const roleHash = await getRoleHash(contract, role);
  console.log('>>>>>>> ac1');
  return encodeFromAgent({
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData('grantRole', [roleHash, account]),
    desc: `${contractName}: Grant "${role}" role to ${account}`,
    gasLimit: 16_000_000,
  });
};

export const encodeFromAgentGrantRolesAccessControlWithConfirm = async (
  contractName: string,
  rolesToGrant: string[],
  contract: Contract,
  rolesBeneficiary: string,
) => {
  printRoles(contractName, rolesToGrant);
  console.log('>>>>>>>> ac2');
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
  console.log('>>>>>>>> ac3');
  return await Promise.all(
    rolesToGrant.map(async (role) => {
      const [, grantRoleCall] = await encodeFromAgentGrantRole(contractName, contract, role, rolesBeneficiary);
      return grantRoleCall;
    }),
  );
};
