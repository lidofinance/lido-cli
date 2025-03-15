import { JsonRpcSigner, Wallet, isAddress } from 'ethers';
import { provider } from './el-provider';
import { envs } from '@configs';

const privateKey = envs?.PRIVATE_KEY;
const accountFile = envs?.ACCOUNT_FILE;
const accountFilePassword = envs?.ACCOUNT_FILE_PASSWORD;
const accountToImpersonate = envs?.IMPERSONATE;

const impersonateAccount = async (accountToImpersonate: string) => {
  await provider.send('hardhat_impersonateAccount', [accountToImpersonate]);
};

const getWallet = () => {
  if (accountToImpersonate) {
    if (!isAddress(accountToImpersonate)) {
      throw new Error('Invalid impersonate address');
    }

    impersonateAccount(accountToImpersonate);
    return new JsonRpcSigner(provider, accountToImpersonate);
  }

  if (privateKey && accountFile) {
    throw new Error('You must provide only one of the following: private key or encrypted account file');
  }

  if (privateKey) {
    return new Wallet(privateKey, provider);
  }

  if (accountFile) {
    if (!accountFilePassword) {
      throw new Error('Account file password is not provided');
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fileContent = require(accountFile);
    return Wallet.fromEncryptedJsonSync(JSON.stringify(fileContent), accountFilePassword).connect(provider);
  }

  throw new Error('Private key or encrypted account file is not provided');
};

export const wallet = getWallet();
