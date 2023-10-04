import { program } from '@command';
import { wallet } from '@providers';
import { join } from 'path';
import { Wallet } from 'ethers';
import { writeToFile } from '@utils';

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

accounts
  .command('encrypt')
  .description('encrypt provided private key')
  .argument('<password>', 'password')
  .option('-k, --private-key <string>', 'private key to encrypt', wallet.privateKey)
  .option('-f, --file-name <string>', 'file name to store result', 'account.json')
  .action(async (password, options) => {
    const { privateKey, fileName } = options;
    const wallet = new Wallet(privateKey);
    const encrypted = await wallet.encrypt(password);

    await writeToFile(join('wallets', fileName), encrypted);
  });
