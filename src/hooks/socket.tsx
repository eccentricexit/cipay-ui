import { useEffect, useState } from 'react';

interface Properties {
  onConnectionOpened?: () => void;
  onConnectionClosed?: (event: CloseEvent) => void;
  onMessageReceived?: (event: MessageEvent) => void;
}

export default function useSocket({
  onConnectionOpened = () => undefined,
  onConnectionClosed = () => undefined,
  onMessageReceived = () => undefined,
}: Properties) {
  const [connection, setConnection] = useState<WebSocket | undefined>();
  const [error, setError] = useState<Event | undefined>();

  useEffect(() => {
    console.info('Attempting to stablish connection...');
    const ws =
      new window.WebSocket(`ws://${process.env.NEXT_PUBLIC_BACKEND_URL}`) || {};

    ws.addEventListener('open', () => {
      console.info(`Connection opened`);

      setConnection(ws);
      onConnectionOpened();
    });

    ws.addEventListener('message', (event) => {
      console.info('Got message', event);

      onMessageReceived(event);
    });

    ws.addEventListener('error', (event) => {
      console.error('Error in websocket');

      setError(event);
    });

    ws.addEventListener('close', (event) => {
      console.info('Closed ws connection:', event.code, event.reason);

      setConnection(undefined);
      onConnectionClosed(event);
    });
  }, [onConnectionClosed, onConnectionOpened, onMessageReceived]);

  return {
    connection,
    error,
  };
}