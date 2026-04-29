import { Contract, Signature } from 'ethers';
import { wallet } from '@providers';
import { DepositData, contractCallTxWithConfirm, joinHex, supplementAndVerifyDepositDataArray } from '@utils';
import permitAbi from 'abi/StETHPermit.json';

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

const PERMIT_VALUE_BUFFER = 10n;
const PERMIT_DEADLINE = 2n ** 256n - 1n;

const buildPermit = async (tokenAddress: string, spender: string, value: bigint) => {
  const token = new Contract(tokenAddress, permitAbi, wallet);
  const [name, nonce, network] = await Promise.all([
    token.name(),
    token.nonces(wallet.address),
    wallet.provider?.getNetwork(),
  ]);

  if (!network) throw new Error('No provider available for permit signing');

  const signature = Signature.from(
    await wallet.signTypedData(
      { name, version: '2', chainId: network.chainId, verifyingContract: tokenAddress },
      {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { owner: wallet.address, spender, value, nonce, deadline: PERMIT_DEADLINE },
    ),
  );

  return [value, PERMIT_DEADLINE, signature.v, signature.r, signature.s] as const;
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

export const addPermissionlessNodeOperatorStETH = async ({
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
  const permit = await buildPermit(
    await accountingContract.LIDO(),
    await accountingContract.getAddress(),
    value + PERMIT_VALUE_BUFFER,
  );

  await contractCallTxWithConfirm(permissionlessGateContract, 'addNodeOperatorStETH', [
    keysCount,
    publicKeys,
    signatures,
    [managerAddress, rewardAddress, !!extendedManagerPermissions],
    permit,
    referrer,
  ]);
};

export const addPermissionlessNodeOperatorStETHFromFile = async (
  filePath: string,
  options: Omit<PermissionlessEntryOptions, 'keysCount' | 'publicKeys' | 'signatures'>,
) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const depositData: DepositData[] = require(filePath);
  await supplementAndVerifyDepositDataArray(depositData);

  await addPermissionlessNodeOperatorStETH({
    ...options,
    keysCount: depositData.length,
    publicKeys: joinHex(depositData.map(({ pubkey }) => pubkey)),
    signatures: joinHex(depositData.map(({ signature }) => signature)),
  });
};
