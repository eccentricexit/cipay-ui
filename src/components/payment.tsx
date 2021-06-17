import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import QrReader from 'react-qr-reader';
import { Card, Button, Spin, notification } from 'antd';
import { CameraOutlined, LoadingOutlined } from '@ant-design/icons';
import Confetti from 'react-confetti';
import {
  BrcodePreview,
  PaymentRequestStatus,
  Reader,
  SignRequest,
} from '../types';
import { useInterval, useWindowSize } from 'react-use';
import { useDebouncedValue, useWallet } from '../hooks';
import { ERC20MetaTransaction } from '../utils';

const paymentStatusToLabel: { [key: string]: string } = {
  [PaymentRequestStatus.created]:
    'Request received and awaits token tx submission.',
  [PaymentRequestStatus.submitted]:
    'Token transfer tx submitted, awaiting confirmation.',
  [PaymentRequestStatus.confirmed]: 'Request confirmed and is being processed.',
  [PaymentRequestStatus.rejected]:
    'These should be used for failed payments that do not warrant refund.',
  [PaymentRequestStatus.failed]: 'This is pending a refund.',
  [PaymentRequestStatus.refunded]:
    'This payment request failed and the client was refunded.',
  [PaymentRequestStatus.processing]: 'Waiting fiat payment.',
  [PaymentRequestStatus.success]: 'Request processed.',
};

function Payment({
  erc20,
  metaTxProxy,
  allowance,
  symbol,
  increaseAllowance,
}: {
  erc20: '' | ethers.Contract | null | undefined;
  metaTxProxy: ethers.Contract | undefined;
  allowance: ethers.BigNumber | unknown;
  symbol: string | unknown;
  increaseAllowance: () => Promise<void> | undefined;
}) {
  const { width, height } = useWindowSize();
  const [error, setError] = useState();
  const { account, onConnectWallet, library, chainId } = useWallet();
  const signer = useMemo(() => library?.getSigner(), [library]);

  const [brcode, setBrcode] = useState('');
  const [brcodePreview, setBrcodePreview] =
    useState<BrcodePreview | undefined>();
  const debouncedBrcode = useDebouncedValue(brcode, 400);
  useEffect(() => {
    (async () => {
      if (!debouncedBrcode) return;

      try {
        const response = await (
          await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/amount-required?brcode=${debouncedBrcode}&tokenAddress=${process.env.REACT_APP_ERC20_ADDRESS}`
          )
        ).json();

        if (response.error) {
          notification['error']({
            message: 'Error fetching amount required',
            description: response.error.message,
            duration: 0,
          });
          setError(response.error);
          return;
        }

        setBrcodePreview(response);
      } catch (error) {
        notification['error']({
          message: 'Error fetching amount required',
          description: error.message,
          duration: 0,
        });
        setError(error);
      }
    })();
  }, [debouncedBrcode, setError]);

  const [paymentRequestSent, setPaymentRequestSent] =
    useState<boolean | undefined>();
  const onRequestPay = useCallback(async () => {
    try {
      if (
        !signer ||
        !account ||
        !chainId ||
        !erc20 ||
        !metaTxProxy ||
        !library ||
        !brcodePreview
      )
        return;

      const { tokenAmountRequired } = brcodePreview || {
        tokenAmountRequired: '0',
      };
      const amount = tokenAmountRequired;
      const from = account;
      const to = process.env.REACT_APP_TARGET_WALLET || '';

      const types = { ERC20MetaTransaction };
      const domain = {
        name: 'MetaTxRelay',
        version: '1',
        verifyingContract: metaTxProxy.address,
      };

      const message: SignRequest = {
        from,
        to,
        tokenContract: erc20.address,
        amount,
        nonce: Number(await metaTxProxy.nonce(from)) + 1,
        expiry: Math.ceil(Date.now() / 1000 + 24 * 60 * 60),
      };
      const signature = await signer._signTypedData(domain, types, message);

      await fetch(`${process.env.REACT_APP_BACKEND_URL}/request-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          web3: {
            signature,
            typedData: {
              domain,
              types,
              message,
            },
            claimedAddr: account,
          },
          brcode: brcode,
        }),
      });
      setPaymentRequestSent(true);
    } catch (error) {
      console.error(
        `Failure!${error && error.message ? `\n\n${error.message}` : ''}`
      );
      setError(error);
      notification['error']({
        message: 'Error',
        description: error.message,
        duration: 0,
      });
    }
  }, [
    account,
    brcode,
    brcodePreview,
    chainId,
    erc20,
    library,
    metaTxProxy,
    signer,
  ]);

  const allowanceEnough = useMemo(() => {
    if (!allowance || !brcodePreview) return false;
    const { tokenAmountRequired } = brcodePreview;
    if (!tokenAmountRequired) return;
    return (allowance as ethers.BigNumber).gte(
      ethers.BigNumber.from(brcodePreview.tokenAmountRequired)
    );
  }, [allowance, brcodePreview]);

  // Track payment request status.
  const [paymentState, setPaymentState] = useState();
  const [polling, setPolling] = useState(true);
  const { status: paymentStatusCode } = paymentState || { status: '' };
  useInterval(
    async () => {
      if (paymentStatusCode === PaymentRequestStatus.success.toString()) {
        setPolling(false);
        return;
      }
      if (!brcodePreview || !paymentRequestSent) return;
      setPaymentState(
        await (
          await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/payment-status?id=${brcodePreview?.id}`
          )
        ).json()
      );
    },
    polling ? 2000 : undefined
  );

  // Read PIX invoice QR Code.
  const qrReaderRefeference = useRef<undefined | Reader>(undefined);
  const openImageDialog = useCallback(() => {
    (qrReaderRefeference as unknown as Reader).current.openImageDialog();
  }, [qrReaderRefeference]);
  const onScanError = useCallback(
    (error) => {
      console.error(error);
      setError(error);
      notification['error']({
        message: 'Error scanning invoice',
        description: error.message,
        duration: 0,
      });
    },
    [setError]
  );
  const onScanSuccess = useCallback((result) => {
    setBrcode(result);
  }, []);

  return (
    <>
      <div>
        {!brcode && !!account && (
          <div>
            <QrReader
              ref={qrReaderRefeference}
              style={{ display: 'none' }}
              onError={onScanError}
              onScan={onScanSuccess}
              showViewFinder={false}
              legacyMode
            />
            <Button
              icon={<CameraOutlined />}
              type="primary"
              size="large"
              shape="round"
              onClick={openImageDialog}
            >
              Capture QR Code
            </Button>
          </div>
        )}
        {brcodePreview && (
          <Card
            loading={!!brcode && !brcodePreview && !error}
            style={{ margin: '24px 0', padding: '24px' }}
          >
            <div>Invoice Due: {brcodePreview?.amount} BRL</div>
            <div>
              You will be charged{' '}
              {ethers.utils.formatUnits(brcodePreview?.tokenAmountRequired, 18)}{' '}
              {symbol}
            </div>
          </Card>
        )}
        {paymentState && (
          <Card style={{ margin: '24px 0', padding: '24px' }}>
            <div>
              Payment status: {paymentStatusToLabel[String(paymentStatusCode)]}
            </div>
          </Card>
        )}
        {brcode && (
          <Card style={{ marginTop: '24px' }}>
            {!account && <Button onClick={onConnectWallet}>Connect</Button>}
            {account && !allowanceEnough && brcodePreview && (
              <Button onClick={increaseAllowance}>Unlock tokens</Button>
            )}
            {account && allowanceEnough && !paymentRequestSent && (
              <Button onClick={onRequestPay}>Pay</Button>
            )}
          </Card>
        )}
      </div>
      {!error && paymentRequestSent && paymentStatusCode !== '7' && (
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
      )}
      {paymentStatusCode === '7' && <Confetti width={width} height={height} />}
    </>
  );
}

export default Payment;
