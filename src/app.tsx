import { PageContent, Input, Button, Stack, Card, Flex } from 'bumbag';
import React, { useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './hooks';
import useSocket from './hooks/socket';
import { ERC20Tokens } from './utils';
import erc20Abi from './abis/erc20.json';

const App = (): JSX.Element => {
  const {
    account,
    onConnectWallet,
    active,
    chainId,
    uncheckedSigner,
    library,
  } = useWallet();
  const { connection } = useSocket({
    onMessageReceived: useCallback(() => undefined, []),
  });

  const tokens = useMemo(() => chainId && ERC20Tokens[chainId], [chainId]);
  const tokenContracts = useMemo(() => {
    if (typeof chainId === 'undefined' || !uncheckedSigner || !tokens) return;
    return Object.values(ERC20Tokens[chainId]).map(
      ({ address }) => new ethers.Contract(address, erc20Abi, uncheckedSigner)
    );
  }, [chainId, tokens, uncheckedSigner]);

  const onRequestPay = useCallback(() => {
    if (
      !uncheckedSigner ||
      !account ||
      !tokenContracts ||
      !chainId ||
      !tokens ||
      !connection
    )
      return;
    (async () => {
      try {
        // For now, only one token is supported.
        const tokenContract = tokenContracts[0];

        console.info('requesting signature...');
        const tx = await tokenContract.transfer(
          process.env.REACT_APP_TARGET_WALLET,
          1
        );

        connection.send(
          JSON.stringify({
            txHash: tx.hash,
            qrCode: 'Here it comes!',
          })
        );
      } catch (error) {
        console.error(
          `Failure!${error && error.message ? `\n\n${error.message}` : ''}`
        );
      }
    })();
  }, [account, chainId, connection, tokenContracts, tokens, uncheckedSigner]);

  return (
    <PageContent>
      {!tokens && 'Network not supported.'}
      <Card>
        <Stack>
          <Input placeholder="Enter your the QR code here." />
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
