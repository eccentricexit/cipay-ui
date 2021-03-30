import { ethers } from 'ethers';

const ForwardRequest = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'gas', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'data', type: 'bytes' },
];

function getMetaTxTypeData(chainId: number, verifyingContract: string) {
  return {
    types: {
      ForwardRequest,
    },
    domain: {
      name: 'MetaTxProxy',
      version: '1.0.0',
      chainId,
      verifyingContract,
    },
    primaryType: 'ForwardRequest',
  };
}

interface SignRequest {
  to: string;
  from: string;
  data: string;
}
export async function buildRequest(
  metaTxProxy: ethers.Contract,
  input: SignRequest
) {
  const nonce = await metaTxProxy
    .nonces(input.from)
    .then((nonce: number) => nonce.toString());
  return { value: 0, gas: 1e6, nonce, ...input };
}

interface TypedData {
  message: SignRequest;
  types: {
    ForwardRequest: {
      name: string;
      type: string;
    }[];
  };
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  primaryType: string;
}
export async function buildTypedData(
  metaTxProxy: ethers.Contract,
  request: SignRequest
): Promise<TypedData> {
  const chainId = await metaTxProxy.provider
    .getNetwork()
    .then((n) => n.chainId);

  const typeData = getMetaTxTypeData(chainId, metaTxProxy.address);
  return { ...typeData, message: request };
}
