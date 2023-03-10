import { program } from '@command';
import { Wallet } from 'ethers';

const accounts = program.command('accounts').description('accounts utils');

accounts
  .command('generate')
  .description('generates new account')
  .action(async () => {
    const wallet = Wallet.createRandom();

    console.log('address', wallet.address);
    console.log('private key', wallet.privateKey);
  });
