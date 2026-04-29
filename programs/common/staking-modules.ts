import { Contract, Signature, TypedDataEncoder } from 'ethers';
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

type VettedEntryOptions = Omit<PermissionlessEntryOptions, 'permissionlessGateContract'> & {
  vettedGateContract: Contract;
  proof: string[];
};

const PERMIT_VALUE_BUFFER = 10n;
const PERMIT_DEADLINE = 2n ** 256n - 1n;
const STETH_PERMIT_DOMAIN_VERSION = '2';
const WSTETH_PERMIT_DOMAIN_VERSION = '1';

const buildPermit = async (tokenAddress: string, spender: string, value: bigint, version: string) => {
  const token = new Contract(tokenAddress, permitAbi, wallet);
  const [name, nonce, domainSeparator, network] = await Promise.all([
    token.name(),
    token.nonces(wallet.address),
    token.DOMAIN_SEPARATOR(),
    wallet.provider?.getNetwork(),
  ]);

  if (!network) throw new Error('No provider available for permit signing');

  const domain = { name, version, chainId: network.chainId, verifyingContract: tokenAddress };
  if (TypedDataEncoder.hashDomain(domain).toLowerCase() !== domainSeparator.toLowerCase()) {
    throw new Error(
      `EIP-712 domain separator mismatch for ${name}. Update the permit domain version in staking-modules.ts`,
    );
  }

  const signature = Signature.from(
    await wallet.signTypedData(
      domain,
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

export const loadProof = (filePath?: string) => {
  if (!filePath) return [] as string[];

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const data = require(filePath);
  if (Array.isArray(data)) return data as string[];

  throw new Error('Proof file must contain a JSON array of bytes32 proof values, e.g. ["0x..."]');
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

export const addVettedNodeOperatorETH = async ({
  accountingContract,
  vettedGateContract,
  keysCount,
  publicKeys,
  signatures,
  managerAddress,
  rewardAddress,
  extendedManagerPermissions,
  referrer,
  proof,
}: VettedEntryOptions) => {
  const curveId = await vettedGateContract.curveId();
  const value = await accountingContract['getBondAmountByKeysCount(uint256,uint256)'](keysCount, curveId);

  await contractCallTxWithConfirm(vettedGateContract, 'addNodeOperatorETH', [
    keysCount,
    publicKeys,
    signatures,
    [managerAddress, rewardAddress, !!extendedManagerPermissions],
    proof,
    referrer,
    { value },
  ]);
};

export const addVettedNodeOperatorETHFromFile = async (
  filePath: string,
  options: Omit<VettedEntryOptions, 'keysCount' | 'publicKeys' | 'signatures'>,
) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const depositData: DepositData[] = require(filePath);
  await supplementAndVerifyDepositDataArray(depositData);

  await addVettedNodeOperatorETH({
    ...options,
    keysCount: depositData.length,
    publicKeys: joinHex(depositData.map(({ pubkey }) => pubkey)),
    signatures: joinHex(depositData.map(({ signature }) => signature)),
  });
};

export const addVettedNodeOperatorStETH = async ({
  accountingContract,
  vettedGateContract,
  keysCount,
  publicKeys,
  signatures,
  managerAddress,
  rewardAddress,
  extendedManagerPermissions,
  referrer,
  proof,
}: VettedEntryOptions) => {
  const curveId = await vettedGateContract.curveId();
  const value = await accountingContract['getBondAmountByKeysCount(uint256,uint256)'](keysCount, curveId);
  const permit = await buildPermit(
    await accountingContract.LIDO(),
    await accountingContract.getAddress(),
    value + PERMIT_VALUE_BUFFER,
    STETH_PERMIT_DOMAIN_VERSION,
  );

  await contractCallTxWithConfirm(vettedGateContract, 'addNodeOperatorStETH', [
    keysCount,
    publicKeys,
    signatures,
    [managerAddress, rewardAddress, !!extendedManagerPermissions],
    permit,
    proof,
    referrer,
  ]);
};

export const addVettedNodeOperatorStETHFromFile = async (
  filePath: string,
  options: Omit<VettedEntryOptions, 'keysCount' | 'publicKeys' | 'signatures'>,
) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const depositData: DepositData[] = require(filePath);
  await supplementAndVerifyDepositDataArray(depositData);

  await addVettedNodeOperatorStETH({
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
    STETH_PERMIT_DOMAIN_VERSION,
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

export const addPermissionlessNodeOperatorWstETH = async ({
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
  const value = await accountingContract['getBondAmountByKeysCountWstETH(uint256,uint256)'](keysCount, curveId);
  const permit = await buildPermit(
    await accountingContract.WSTETH(),
    await accountingContract.getAddress(),
    value + PERMIT_VALUE_BUFFER,
    WSTETH_PERMIT_DOMAIN_VERSION,
  );

  await contractCallTxWithConfirm(permissionlessGateContract, 'addNodeOperatorWstETH', [
    keysCount,
    publicKeys,
    signatures,
    [managerAddress, rewardAddress, !!extendedManagerPermissions],
    permit,
    referrer,
  ]);
};

export const addPermissionlessNodeOperatorWstETHFromFile = async (
  filePath: string,
  options: Omit<PermissionlessEntryOptions, 'keysCount' | 'publicKeys' | 'signatures'>,
) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const depositData: DepositData[] = require(filePath);
  await supplementAndVerifyDepositDataArray(depositData);

  await addPermissionlessNodeOperatorWstETH({
    ...options,
    keysCount: depositData.length,
    publicKeys: joinHex(depositData.map(({ pubkey }) => pubkey)),
    signatures: joinHex(depositData.map(({ signature }) => signature)),
  });
};
