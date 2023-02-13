import { Contract, isHexString } from 'ethers';

export const getRolePosition = async (contract: Contract, role: string) => {
  if (isHexString(role)) return role;
  return await contract[role]();
};
