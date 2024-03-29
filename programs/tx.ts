import { program } from '@command';
import { provider } from '@providers';
import { buildTraceTree, formatTraceNode, getAllAbi, logger, printTree } from '@utils';
import { parseEther } from 'ethers';

const tx = program.command('tx').description('transaction utils');

tx.command('get-tx')
  .description('fetches transaction by hash')
  .argument('<hash>', 'transaction hash')
  .action(async (hash) => {
    const transaction = await provider.getTransaction(hash);
    logger.log(transaction);
  });

tx.command('parse-calldata')
  .description('decodes transaction calldata with ABI')
  .argument('<calldata>', 'transaction calldata')
  .option('-v, --value <string>', 'transaction value', '0')
  .action(async (calldata, options) => {
    const { value } = options;

    const ethValue = parseEther(value);
    const tx = { data: calldata, value: ethValue };

    const abi = getAllAbi();

    abi.forEach(({ name, iface }) => {
      const result = iface.parseTransaction(tx);

      if (result) {
        logger.log(name, result);
      }
    });
  });

tx.command('parse-method')
  .description('decodes transaction method with ABI')
  .argument('<selector>', '4byte transaction method selector')
  .action(async (selector) => {
    const abi = getAllAbi();

    abi.forEach(({ name, iface }) => {
      iface.forEachFunction((func) => {
        if (func.selector === selector) {
          logger.log(name, func);
        }
      });
    });
  });

tx.command('parse-error')
  .description('decodes transaction revert reason with ABI')
  .argument('<reason>', 'transaction revert reason')
  .action(async (reason) => {
    const abi = getAllAbi();

    abi.forEach(({ name, iface }) => {
      const result = iface.parseError(reason);

      if (result) {
        logger.log(name, result);
      }
    });
  });

tx.command('trace')
  .description('traces transaction')
  .argument('<tx-hash>', 'transaction hash')
  .action(async (txHash) => {
    const { trace } = await provider.send('trace_replayTransaction', [txHash, ['trace']]);
    const traceTree = buildTraceTree(trace);

    printTree(traceTree, formatTraceNode);
  });
