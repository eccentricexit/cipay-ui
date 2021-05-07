import { Input, Button, Stack, Card, Flex, Alert, Text } from 'bumbag';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { useDebounce, useWallet } from './hooks';
import erc20Abi from './abis/erc20.ovm.json';
import metaTxProxyAbi from './abis/metaTxProxy.ovm.json';
import { ERC20MetaTransaction } from './utils';
import { UnsupportedChainIdError } from '@web3-react/core';

interface SignRequest {
  from: string;
  to: string;
  tokenContract: string;
  amount: string;
  nonce: number;
  expiry: number;
}

const App = (): JSX.Element => {
  const {
    account,
    onConnectWallet,
    active,
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
    { tokenAmountRequired: string } | undefined
  >();
  const onBrcodeReceived = useCallback((event) => {
    setBrcode(event.target.value || '');
  }, []);
  const debouncedBrcode = useDebounce(brcode, 400);
  useEffect(() => {
    (async () => {
      if (!debouncedBrcode) return;

      setBrcodePreview(
        await (
          await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/amount-required?brcode=${debouncedBrcode}&tokenAddress=${process.env.REACT_APP_ERC20_ADDRESS}`
          )
        ).json()
      );
    })();
  }, [debouncedBrcode]);

  const [allowance, setAllowance] = useState<ethers.BigNumber | undefined>();
  useEffect(() => {
    (async () => {
      if (!account || !erc20 || !metaTxProxy) return;

      setAllowance(await erc20.allowances(account, metaTxProxy.address));
    })();
  }, [account, erc20, metaTxProxy]);
  const allowanceEnough = useMemo(() => {
    if (!allowance || !brcodePreview) return false;
    return allowance.gte(
      ethers.BigNumber.from(brcodePreview.tokenAmountRequired)
    );
  }, [allowance, brcodePreview]);
  const increaseAllowance = useCallback(async () => {
    if (!erc20 || !brcodePreview || !metaTxProxy) return;
    erc20.approve(
      metaTxProxy.address,
      '1000000000000000000000000000000000000000'
    );
  }, [brcodePreview, erc20, metaTxProxy]);

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

  return (
    <Flex alignX="center" flexDirection="column">
      <Text>Cipay</Text>
      {error && (
        <Alert title="Error" type="danger">
          {JSON.stringify(error)}
        </Alert>
      )}
      <Card>
        <Stack>
          <Input
            placeholder="Enter your the QR code here."
            onChange={onBrcodeReceived}
            value={brcode}
          />
          <Flex alignX="right">
            <Button onClick={generatePixInvoice}>Generate Pix Invoice</Button>
            {allowance && brcodePreview && !allowanceEnough && (
              <Button palette="primary" onClick={increaseAllowance}>
                Unlock Token
              </Button>
            )}
            {brcodePreview &&
              (active ? (
                library &&
                account && (
                  <Button palette="primary" onClick={onRequestPay}>
                    Pay
                  </Button>
                )
              ) : (
                <Button palette="primary" onClick={onConnectWallet}>
                  Connect
                </Button>
              ))}
          </Flex>
        </Stack>
      </Card>
    </Flex>
  );
};

export default App;
