export interface SignRequest {
  from: string;
  to: string;
  tokenContract: string;
  amount: string;
  nonce: number;
  expiry: number;
}

export interface BrcodePreview {
  id: string;
  status: string;
  name: string;
  taxId: string;
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  accountType: string;
  allowChange: boolean;
  amount: number;
  reconciliationId: string;
  description: string;
  tokenAmountRequired: string;
  tokenSymbol: string;
}

export interface Reader {
  current: { openImageDialog: () => void };
}

export enum PaymentRequestStatus {
  created, // Request received and awaits token tx submission.
  submitted, // Token transfer tx submitted, awaiting confirmation.
  confirmed, // Request confirmed and is being processed.
  rejected, // These should be used for failed payments that do not warrant refund.
  failed, // This is pending a refund.
  refunded, // This payment request failed and the client was refunded.
  processing, // Waiting fiat payment.
  success, // Request processed.
}
