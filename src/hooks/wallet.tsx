import { useWeb3React } from '@web3-react/core';
import { useCallback, useEffect, useState } from 'react';
import { AbstractConnector } from '@web3-react/abstract-connector';
import { ethers } from 'ethers';
import { Web3ReactContextInterface } from '@web3-react/core/dist/types';
import useEagerConnect from './eager-connect';
import useInactiveListener from './inactive-listener';
import { injected } from '../connectors';
import chains from '../connectors/chains.json';
import { supportedChains } from '../utils';

enum ConnectorNames {
  Injected = 'Injected',
}

const connectorsByName: {
  [connectorName in ConnectorNames]: AbstractConnector;
} = {
  [ConnectorNames.Injected]: injected,
};

interface Properties extends Web3ReactContextInterface {
  onConnectWallet: () => void;
  switchToChainId: (chainId: number) => () => Promise<void>;
  unsupportedNetwork: ethers.providers.Network | undefined;
  library?: ethers.providers.JsonRpcProvider;
}

// Requires web3-react in the context.
const useWallet = (): Properties => {
  const web3ReactContext = useWeb3React();
  const { activate, connector, active, chainId, account } = web3ReactContext;
  const library: ethers.providers.JsonRpcProvider = web3ReactContext.library;

  // Handle logic to recognize the connector currently being activated.
  const [activatingConnector, setActivatingConnector] = useState<unknown>();
  useEffect(() => {
    if (activatingConnector && activatingConnector === connector)
      setActivatingConnector(undefined);
  }, [activatingConnector, connector]);

  // Handle logic to eagerly connect to the injected ethereum provider, if it exists and has granted access already.
  const triedEager = useEagerConnect();

  // Handle logic to connect in reaction to certain events on the injected ethereum provider, if it exists.
  useInactiveListener(!triedEager || !!activatingConnector);

  const onConnectWallet = useCallback(() => {
    setActivatingConnector(connectorsByName[ConnectorNames.Injected]);
    activate(connectorsByName[ConnectorNames.Injected]);
  }, [activate]);

  // Handle network support.
  const [unsupportedNetwork, setUnsupportedNetwork] =
    useState<ethers.providers.Network | undefined>();
  useEffect(() => {
    if (!account || !chainId || !active) return;

    (async function checkSupportedNetwork() {
      try {
        const connectedNetwork = await library?.getNetwork();
        if (!supportedChains.has(connectedNetwork?.chainId)) {
          setUnsupportedNetwork(connectedNetwork);
          return;
        } else setUnsupportedNetwork(undefined);
      } catch (error) {
        console.error(error);
        // TODO: Handle error
      }
    })();
  }, [account, active, chainId, library]);

  // Request wallet to change chain.
  const switchToChainId = useCallback(
    (chainId: number) => async () => {
      const networkInfo = chains.find((c) => c.chainId === chainId);
      if (!networkInfo || !account) throw new Error('Network no found');

      try {
        await library?.send('wallet_addEthereumChain', [
          {
            chainId: `0x${networkInfo.chainId.toString(16)}`,
            nativeCurrency: networkInfo.nativeCurrency,
            chainName: networkInfo.name,
            rpcUrls: networkInfo.rpc,
            blockExplorerUrls: networkInfo.explorers,
          },
        ]);

        setUnsupportedNetwork(undefined);
      } catch (error) {
        console.error(error);
      }
    },
    [account, library]
  );

  return {
    ...web3ReactContext,
    unsupportedNetwork,
    onConnectWallet,
    library,
    switchToChainId,
  };
};

export default useWallet;
