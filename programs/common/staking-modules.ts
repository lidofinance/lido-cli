import { Contract } from 'ethers';
import { DepositData, contractCallTxWithConfirm, joinHex, supplementAndVerifyDepositDataArray } from '@utils';

type PermissionlessEntryOptions = {
  accountingContract: Contract;
  permissionlessGateContract: Contract;
  keysCount: string | number | bigint;
  publicKeys: string;
  signatures: string;
  managerAddress: string;
  rewardAddress: string;
  extendedManagerPermissions: boolean;
  referrer: string;
};

export const addPermissionlessNodeOperatorETH = async ({
  accountingContract,
  permissionlessGateContract,
  keysCount,
  publicKeys,
  signatures,
  managerAddress,
  rewardAddress,
  extendedManagerPermissions,
  referrer,
}: PermissionlessEntryOptions) => {
  const curveId = await accountingContract.DEFAULT_BOND_CURVE_ID();
  const value = await accountingContract['getBondAmountByKeysCount(uint256,uint256)'](keysCount, curveId);

  await contractCallTxWithConfirm(permissionlessGateContract, 'addNodeOperatorETH', [
    keysCount,
    publicKeys,
    signatures,
    [managerAddress, rewardAddress, !!extendedManagerPermissions],
    referrer,
    { value },
  ]);
};

export const addPermissionlessNodeOperatorETHFromFile = async (
  filePath: string,
  options: Omit<PermissionlessEntryOptions, 'keysCount' | 'publicKeys' | 'signatures'>,
) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const depositData: DepositData[] = require(filePath);
  await supplementAndVerifyDepositDataArray(depositData);

  await addPermissionlessNodeOperatorETH({
    ...options,
    keysCount: depositData.length,
    publicKeys: joinHex(depositData.map(({ pubkey }) => pubkey)),
    signatures: joinHex(depositData.map(({ signature }) => signature)),
  });
};
