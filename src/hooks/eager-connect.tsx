import { useState, useEffect } from 'react';
import { useWeb3React } from '@web3-react/core';
import { injected } from '../connectors';

export default function useEagerConnect(): boolean {
  const { activate, active } = useWeb3React();
  const [tried, setTried] = useState(false);

  useEffect(() => {
    (async () => {
      if (tried) return;
      try {
        if (await injected.isAuthorized()) activate(injected, undefined, false);
      } catch {
        setTried(true);
      }
    })();
  }, [activate, tried]);

  // If the connection worked, wait until we get confirmation of that to flip the flag.
  useEffect(() => {
    if (!tried && active) setTried(true);
  }, [tried, active]);

  return tried;
}
