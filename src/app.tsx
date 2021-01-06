import { PageContent, Input, Button, Stack, Card, Flex } from 'bumbag';
import React, { useCallback } from 'react';
import { useWallet } from './hooks';
import useSocket from './hooks/socket';

const App = (): JSX.Element => {
  const { library, account, onConnectWallet, active } = useWallet();
  const { connection } = useSocket({
    onMessageReceived: useCallback(() => undefined, []),
  });

  const onRequestPay = useCallback(() => {
    if (!library || !account || !connection) return;
    (async () => {
      try {
        const signer = library.getSigner(account);
        const signature = await signer.signMessage('👋');

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
