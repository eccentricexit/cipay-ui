import { InjectedConnector } from '@web3-react/injected-connector';
import chains from './chains.json';

// Note that chain support is handled in the UI, not
// at the connector level.
export const injected = new InjectedConnector({
  supportedChainIds: chains.map((c) => c.chainId),
});
