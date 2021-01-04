import { PageContent, Input, Button, Stack, Card, Flex } from 'bumbag';
import { useCallback, useEffect, useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import { AbstractConnector } from '@web3-react/abstract-connector';

import { useEagerConnect, useInactiveListener } from './hooks';
import { injected } from './connectors';

enum ConnectorNames {
  Injected = 'Injected',
}

const connectorsByName: {
  [connectorName in ConnectorNames]: AbstractConnector;
} = {
  [ConnectorNames.Injected]: injected,
};

const App = (): JSX.Element => {
  const web3ReactContext = useWeb3React();
  const { account, active, activate, connector } = web3ReactContext;
  const library: Web3Provider = web3ReactContext.library;
  const [connection, setConnection] = useState<WebSocket | undefined>();

  // handle logic to recognize the connector currently being activated
  const [activatingConnector, setActivatingConnector] = useState<any>();
  useEffect(() => {
    if (activatingConnector && activatingConnector === connector) {
      setActivatingConnector(undefined);
    }
  }, [activatingConnector, connector]);

  // handle logic to eagerly connect to the injected ethereum provider, if it exists and has granted access already
  const triedEager = useEagerConnect();

  // handle logic to connect in reaction to certain events on the injected ethereum provider, if it exists
  useInactiveListener(!triedEager || !!activatingConnector);

  const onConnectWallet = useCallback(() => {
    setActivatingConnector(connectorsByName[ConnectorNames.Injected]);
    activate(connectorsByName[ConnectorNames.Injected]);
  }, [activate]);

  useEffect(() => {
    console.info('Attempting to stablish connection...');
    const ws =
      new window.WebSocket(`ws://${process.env.NEXT_PUBLIC_BACKEND_URL}`) || {};

    ws.addEventListener('open', () => {
      console.info(`Connection opened`);
      setConnection(ws);
      ws.send('Hello');
    });

    ws.addEventListener('message', (event) => {
      console.info('Got message', event.data);
    });

    ws.addEventListener('error', () => {
      console.error('Error in websocket');
    });

    ws.addEventListener('close', (event) => {
      console.info('Closed ws connection:', event.code, event.reason);
      setConnection(undefined);
    });
  }, []);

  const onRequestPay = useCallback(() => {
    if (!library || !account || !connection) return;
    (async () => {
      try {
        const signer = library.getSigner(account);
        const signature = await signer.signMessage('👋');
        console.info('Got signature', signature);

        connection.send(
          JSON.stringify({
            signature,
            qrCode: 'Here it comes!',
          })
        );
        console.info('Message sent');
      } catch (error) {
        console.error(
          `Failure!${error && error.message ? `\n\n${error.message}` : ''}`
        );
      }
    })();
  }, [library, account, connection]);

  return (
    <PageContent>
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
