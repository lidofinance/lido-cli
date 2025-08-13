import { withdrawalRequestContract } from '@contracts';
import { encodeUnpauseIfPaused } from './pause-until';

export const encodeScriptsWQResumeIfPaused = async () => {
  console.log('>>>>>>>> wq1');
  return encodeUnpauseIfPaused('WQ', withdrawalRequestContract);
};
