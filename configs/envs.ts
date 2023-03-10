import * as dotenv from 'dotenv';

const { parsed } = dotenv.config();

export const envs = parsed;
