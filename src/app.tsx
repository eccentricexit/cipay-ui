import { PageContent, Input, Button, Stack, Card, Flex } from 'bumbag';
import React, { useCallback, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './hooks';
import erc20Abi from './abis/erc20.json';
import metaTxProxyAbi from './abis/metaTxProxy.json';
import { buildRequest, buildTypedData } from './utils';

const App = (): JSX.Element => {
  const { account, onConnectWallet, active, chainId, library } = useWallet();
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

  const [brCode, setBrCode] = useState('');
  const onQRCodeReceived = useCallback((event) => {
    setBrCode(event.target.value || '');
  }, []);

  const onRequestPay = useCallback(() => {
    if (!signer || !account || !chainId || !erc20 || !metaTxProxy || !library)
      return;
    (async (): Promise<void> => {
      try {
        // TODO: Fetch required amount of tokens from backend.
        const amount = 1;
        const from = account;
        const to = account;
        const data = erc20.interface.encodeFunctionData('transferFrom', [
          from,
          to,
          amount,
        ]);
        const request = await buildRequest(metaTxProxy, {
          to: erc20.address,
          from,
          data,
        });

        const { domain, types, message } = await buildTypedData(
          metaTxProxy,
          request
        );
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
            },
            brCode,
          }),
        });
      } catch (error) {
        console.error(
          `Failure!${error && error.message ? `\n\n${error.message}` : ''}`
        );
      }
    })();
  }, [account, brCode, chainId, erc20, library, metaTxProxy, signer]);

  return (
    <PageContent>
      <Card>
        <Stack>
          <Input
            placeholder="Enter your the QR code here."
            onChange={onQRCodeReceived}
            value={brCode}
          />
          <Flex alignX="right">
            {active ? (
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
            )}
          </Flex>
        </Stack>
      </Card>
    </PageContent>
  );
};

export default App;
