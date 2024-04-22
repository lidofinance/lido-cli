import { JsonRpcSigner, Wallet, isAddress } from 'ethers';
import * as dotenv from 'dotenv';
import { provider } from './el-provider';
import { program } from '@command';

const { parsed } = dotenv.config();
const privateKey = parsed?.PRIVATE_KEY;
const accountFile = parsed?.ACCOUNT_FILE;
const accountFilePassword = parsed?.ACCOUNT_FILE_PASSWORD;

const getWallet = () => {
  const accountToInpersonate = program.getOptionValue('inpersonate');

  if (accountToInpersonate) {
    if (!isAddress(accountToInpersonate)) {
      throw new Error('Invalid inpersonate address');
    }

    return new JsonRpcSigner(provider, accountToInpersonate);
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
