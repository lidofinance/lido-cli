import { Contract, isHexString } from 'ethers';
import { wallet } from '../wallet';

export const getRolePosition = async (contract: Contract, role: string) => {
  if (isHexString(role)) return role;
  return await contract[role]();
};

export const getRolePositionByAddress = async (address: string, role: string) => {
  if (isHexString(role)) return role;

  const contract = new Contract(
    address,
    [
      {
        constant: true,
        inputs: [],
        name: role,
        outputs: [{ name: '', type: 'bytes32' }],
        payable: false,
        stateMutability: 'view',
        type: 'function',
      },
    ],
    wallet,
  );

  return await contract[role]();
};
