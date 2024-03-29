import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { UnsupportedChainIdError } from '@web3-react/core';
import { Body1, Body2, Button, H1, ProgressCircular } from 'ui-neumorphism';
import { ethers } from 'ethers';
import QrReader from 'react-qr-reader';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';
import { useDebounce, useInterval, useWallet } from './hooks';
import erc20Abi from './abis/erc20.ovm.json';
import metaTxProxyAbi from './abis/metaTxProxy.ovm.json';
import { ERC20MetaTransaction } from './utils';

interface SignRequest {
  from: string;
  to: string;
  tokenContract: string;
  amount: string;
  nonce: number;
  expiry: number;
}
interface BrcodePreview {
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
interface Reader {
  current: { openImageDialog: () => void };
}

const paymentStatusToLabel: { [key: string]: string } = {
  '0': 'Request received and awaits token tx submission.',
  '1': 'Token transfer tx submitted, awaiting confirmation.',
  '2': 'Request confirmed and is being processed.',
  '3': 'These should be used for failed payments that do not warrant refund.',
  '4': 'This is pending a refund.',
  '5': 'This payment request failed and the client was refunded.',
  '6': 'Waiting fiat payment.',
  '7': 'Request processed.',
};

const App = (): JSX.Element => {
  const { width, height } = useWindowSize();
  const {
    account,
    onConnectWallet,
    chainId,
    library,
    error: walletError,
  } = useWallet();
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    if (walletError) setError(walletError);
    if (!walletError && error && error instanceof UnsupportedChainIdError)
      setError(undefined);
  }, [error, walletError]);

  const signer = useMemo(() => library?.getSigner(), [library]);
  const erc20 = useMemo(
    () =>
      new ethers.Contract(
        process.env.REACT_APP_ERC20_ADDRESS || '',
        erc20Abi,
        signer
      ),
    [signer]
  );
  const metaTxProxy = useMemo(
    () =>
      new ethers.Contract(
        process.env.REACT_APP_META_TX_PROXY_ADDRESS || '',
        metaTxProxyAbi,
        signer
      ),
    [signer]
  );

  const [brcode, setBrcode] = useState('');
  const [brcodePreview, setBrcodePreview] = useState<
    BrcodePreview | undefined
  >();
  const debouncedBrcode = useDebounce(brcode, 400);
  useEffect(() => {
    (async () => {
      if (!debouncedBrcode) return;

      const response = await (
        await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/amount-required?brcode=${debouncedBrcode}&tokenAddress=${process.env.REACT_APP_ERC20_ADDRESS}`
        )
      ).json();

      if (response.error) {
        setError(response.error);
        return;
      }

      setBrcodePreview(response);
    })();
  }, [debouncedBrcode]);

  const [allowance, setAllowance] = useState<ethers.BigNumber | undefined>();
  const [symbol, setSymbol] = useState<string | undefined>();
  const [balance, setBalance] = useState<ethers.BigNumber | undefined>();
  useEffect(() => {
    (async () => {
      if (!account || !erc20 || !metaTxProxy) return;

      const [
        allowanceReturned,
        symbolReturned,
        balanceReturned,
      ] = await Promise.all([
        erc20.allowance(account, metaTxProxy.address),
        erc20.symbol(),
        erc20.balanceOf(account),
      ]);
      setAllowance(allowanceReturned);
      setSymbol(symbolReturned);
      setBalance(balanceReturned);
    })();
  }, [account, erc20, metaTxProxy]);
  const allowanceEnough = useMemo(() => {
    if (!allowance || !brcodePreview) return false;
    const { tokenAmountRequired } = brcodePreview;
    if (!tokenAmountRequired) return;
    return allowance.gte(
      ethers.BigNumber.from(brcodePreview.tokenAmountRequired)
    );
  }, [allowance, brcodePreview]);
  const increaseAllowance = useCallback(async () => {
    if (!erc20 || !brcodePreview || !metaTxProxy) return;
    const tx = await erc20.approve(
      metaTxProxy.address,
      '1000000000000000000000000000000000000000'
    );
    await tx.wait();
    setAllowance(await erc20.allowance(account, metaTxProxy.address));
  }, [account, brcodePreview, erc20, metaTxProxy]);

  const [paymentRequestSent, setPaymentRequestSent] = useState<
    boolean | undefined
  >();
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
        version: '1.0.0',
        chainId: chainId.toString(),
        verifyingContract: metaTxProxy.address,
      };

      const message: SignRequest = {
        from,
        to,
        tokenContract: erc20.address,
        amount,
        nonce: Number(await metaTxProxy.nonce(from)) + 1,
        expiry: Math.ceil(Date.now() / 1000 + 24 * 60 * 60), // 24 hours.
      };
      const signature = await signer._signTypedData(domain, types, message);

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/request-payment`,
        {
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
        }
      );

      const parsedResponse = await response.json();
      console.info(parsedResponse);

      if (response.status !== 200)
        throw new Error(JSON.stringify(parsedResponse));

      setPaymentRequestSent(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const errorMessage = error ? (error.message ? error.message : error) : ``;
      console.error(`Failure! ${errorMessage}`);
      setError(error);
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

  const [paymentState, setPaymentState] = useState();
  const [polling, setPolling] = useState(true);
  const { status: paymentStatusCode } = paymentState || { status: '' };
  useInterval(
    async () => {
      if (paymentStatusCode === '7') {
        setPolling(false);
        return;
      }
      if (!brcodePreview || !paymentRequestSent) return;
      const paymentState = await (
        await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/payment-status?id=${brcodePreview?.id}`
        )
      ).json();
      setPaymentState(paymentState);
    },
    polling ? 10000 : undefined
  );

  const qrReaderRefeference = useRef<undefined | Reader>(undefined);
  const openImageDialog = useCallback(() => {
    ((qrReaderRefeference as unknown) as Reader).current.openImageDialog();
  }, [qrReaderRefeference]);
  const onScanError = useCallback((error) => {
    console.error(error);
    setError(error);
  }, []);
  const onScanSuccess = useCallback((result) => {
    setBrcode(result);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        flexDirection: 'column',
      }}
    >
      <H1 style={{ marginBottom: '24px' }}>Cipay</H1>
      <div
        style={{
          maxWidth: '375px',
        }}
      >
        {error && JSON.stringify(error)}
        {!brcode && <Body1>Read a PIX invoice</Body1>}
        {!brcode && (
          <div style={{ margin: '32px 0' }}>
            <QrReader
              ref={qrReaderRefeference}
              style={{ display: 'none' }}
              onError={onScanError}
              onScan={onScanSuccess}
              showViewFinder={false}
              legacyMode
            />
            <Button
              color="#fff"
              bgColor="var(--primary)"
              onClick={openImageDialog}
            >
              Capture QR Code
            </Button>
          </div>
        )}
        {brcode && (
          <Body2 style={{ wordBreak: 'break-all' }}>Invoice: {brcode}</Body2>
        )}
        {brcodePreview && balance && (
          <div style={{ margin: '24px 0' }}>
            <Body2>Invoice Due: {brcodePreview?.amount / 100} BRL</Body2>
            <Body2>
              You will be charged{' '}
              {ethers.utils.formatUnits(brcodePreview?.tokenAmountRequired, 18)}{' '}
              {symbol}
            </Body2>
            <Body2>
              Current balance: {ethers.utils.formatUnits(balance, 18)}{' '}
            </Body2>
          </div>
        )}
        {paymentState && (
          <div style={{ margin: '24px 0' }}>
            <Body2>
              Payment status: {paymentStatusToLabel[String(paymentStatusCode)]}
            </Body2>
          </div>
        )}
        <div style={{ marginTop: '24px' }}>
          {brcode && !account && (
            <Button
              color="#fff"
              bgColor="var(--primary)"
              onClick={onConnectWallet}
            >
              Connect
            </Button>
          )}
          {brcode && account && !allowanceEnough && brcodePreview && (
            <Button
              color="#fff"
              bgColor="var(--primary)"
              onClick={increaseAllowance}
            >
              Unlock tokens
            </Button>
          )}
          {brcode && account && allowanceEnough && !paymentRequestSent && (
            <Button
              color="#fff"
              bgColor="var(--primary)"
              onClick={onRequestPay}
            >
              Pay
            </Button>
          )}
        </div>
      </div>
      {!error && paymentRequestSent && paymentStatusCode !== '7' && (
        <ProgressCircular indeterminate color="var(--primary)" />
      )}
      {paymentStatusCode === '7' && <Confetti width={width} height={height} />}
    </div>
  );
};

export default App;
