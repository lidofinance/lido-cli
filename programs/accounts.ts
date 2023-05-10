import { program } from '@command';
import { wallet } from '@providers';
import { Wallet } from 'ethers';

const accounts = program.command('accounts').description('accounts utils');

accounts
  .command('generate')
  .description('generates new account')
  .action(async () => {
    const wallet = Wallet.createRandom();

    console.table({
      address: wallet.address,
      'private key': wallet.privateKey,
    });
  });

accounts
  .command('address')
  .description('returns address from private key')
  .action(async () => {
    console.log(wallet.address);
  });
