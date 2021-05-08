import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UnsupportedChainIdError } from '@web3-react/core';
import { Body1, Body2, Button, H1 } from 'ui-neumorphism';
import { ethers } from 'ethers';
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

      if (response.error) throw new Error(response.error);

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

  const generatePixInvoice = useCallback(async () => {
    try {
      const {
        invoice: { brcode },
      } = await (
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/generate-brcode`, {
          method: 'POST',
        })
      ).json();

      setBrcode(brcode);
    } catch (generatePixInvoiceError) {
      setError(generatePixInvoiceError);
    }
  }, []);

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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          minWidth: '400px',
        }}
      >
        <H1 style={{ marginBottom: '24px' }}>Cipay</H1>
        {!brcode && <Body1>Generate Invoice a test invoice</Body1>}
        <Body2 style={{ wordBreak: 'break-all' }}>Invoice: {brcode}</Body2>
        {brcodePreview && balance && (
          <div style={{ margin: '24px 0' }}>
            <Body2>Invoice Due: {brcodePreview?.amount} BRL</Body2>
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
          {!brcode && (
            <Button
              bgColor="var(--primary)"
              color="#fff"
              onClick={generatePixInvoice}
            >
              Generate Invoice
            </Button>
          )}
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
    </div>
  );
};

export default App;
