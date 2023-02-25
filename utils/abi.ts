import { Interface } from 'ethers';
import { lstatSync, readdirSync } from 'fs';
import { parse, resolve } from 'path';

export const getAllAbi = () => {
  const abiFiles = fetchFilesRecursive('./abi');

  return abiFiles.map((fullPath) => {
    const name = parse(fullPath).name;
    const abi = require(fullPath);
    const iface = new Interface(abi);

    return { name, abi, iface };
  });
};

const fetchFilesRecursive = (dir: string, files: string[] = []) => {
  const filesInDir = readdirSync(dir);

  for (const file of filesInDir) {
    const fullPath = resolve(dir, file);
    const isDirectory = lstatSync(fullPath).isDirectory();

    if (isDirectory) {
      fetchFilesRecursive(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
};
