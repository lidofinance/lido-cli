import { isAddress } from 'ethers';

export const fetchEtherscanSignatureDetailsForAddress = async (address: string) => {
  const signatureIds = await fetchEtherscanSignatureIdsForAddress(address);
  const signatureDetails = await Promise.all(signatureIds.map((signatureId) => fetchSignatureDetailsById(signatureId)));
  return signatureDetails;
};

export const fetchEtherscanSignatureIdsForAddress = async (address: string) => {
  if (!isAddress(address)) {
    throw new Error('Invalid address');
  }

  const pageContent = await fetchEtherscanPageContent(`verifiedSignatures?q=${address}`);
  const signatureIds = extractSignatureIdsFromText(pageContent);
  return signatureIds;
};

export const fetchSignatureDetailsById = async (id: number) => {
  if (typeof id !== 'number') {
    throw new Error('Invalid id');
  }

  const pageContent = await fetchEtherscanPageContent(`verifySig/${id}`);
  const details = extractSignatureDetailsFromText(pageContent);
  return details;
};

export const extractSignatureIdsFromText = (content: string) => {
  const regexp = /href="\/verifySig\/([0-9]+)"/g;
  const matches = [...content.matchAll(regexp)];
  const ids = matches.map(([, id]) => Number(id));
  return ids;
};

export const extractSignatureDetailsFromText = (content: string) => {
  const regexp = /(class="form-control">([^<]+)<\/textarea>)|(type="text" value="([^"]+)")/g;
  const matches = [...content.matchAll(regexp)];
  const details = matches.map(([, , textareaValue, , inputValue]) => (textareaValue || inputValue).trim());

  if (details.length !== 3) {
    throw new Error('Failed to extract details');
  }

  return {
    address: details[0],
    message: details[1],
    signature: details[2],
  };
};

export const fetchEtherscanPageContent = async (path: string) => {
  const url = `https://etherscan.io/${path}`;
  const result = await fetch(url);

  if (!result.ok || result.status !== 200) {
    throw new Error('Failed to fetch');
  }

  return await result.text();
};
