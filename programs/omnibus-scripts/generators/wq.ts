import { withdrawalRequestContract } from '@contracts';
import { encodeUnpauseIfPaused } from './pause-until';

export const encodeScriptsWQResumeIfPaused = async () => {
  return encodeUnpauseIfPaused('WQ', withdrawalRequestContract);
};
