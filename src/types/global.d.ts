import { ethers } from 'ethers';

/* eslint-disable unicorn/prevent-abbreviations */
declare namespace NodeJS {
  export interface ProcessEnv {
    REACT_APP_BACKEND_URL: string;
    REACT_APP_TARGET_WALLET: string;
  }
}

declare class UncheckedJsonRpcSigner extends ethers.providers.JsonRpcSigner {
  sendTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<TransactionResponse>;
}
