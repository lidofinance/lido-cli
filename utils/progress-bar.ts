import progress from 'cli-progress';
import { sleep } from './sleep';
import { logger } from './logger';

export const waitWithProgressBar = async (
  title: string,
  getState: () => Promise<{ total: number; currentPosition: number; secondsLeft: number }>,
  step = 5_000,
) => {
  const progressBar = new progress.SingleBar(
    { format: `${title} |{bar}| {percentage}% | {secondsLeft}s left` },
    progress.Presets.shades_classic,
  );

  const state = await getState();
  let { currentPosition, secondsLeft } = state;
  progressBar.start(state.total, currentPosition, { secondsLeft });

  while (secondsLeft > 0) {
    ({ currentPosition, secondsLeft } = await getState());
    progressBar.update(currentPosition, { secondsLeft });
    await sleep(step);
  }

  progressBar.stop();
  logger.log('');
  return progressBar;
};
