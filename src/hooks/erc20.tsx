import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import erc20Abi from '../abis/erc20.ovm.json';
import { useInterval, useWallet } from '.';
import { supportedChains } from '../utils';

export default function useERC20MetaTx(
  address: string,
  metaTxProxy: ethers.Contract,
  fetchTokenRate: () => Promise<string>,
  pollPeriod = 5 * 1000
) {
  const { library, account, chainId } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string }>();
  const signer = useMemo(() => library?.getSigner(), [library]);

  const erc20 = useMemo(
    () =>
      signer &&
      account &&
      address &&
      new ethers.Contract(address, erc20Abi, signer),
    [account, address, signer]
  );

  // Fetch token wallet data.
  const [allowance, setAllowance] = useState<ethers.BigNumber | unknown>();
  const [balance, setBalance] = useState<ethers.BigNumber | unknown>();
  const [decimals, setDecimals] = useState<ethers.BigNumber | unknown>();
  const [symbol, setSymbol] = useState<string | unknown>();
  useEffect(() => {
    (async () => {
      if (!account || !erc20 || !metaTxProxy || !chainId) return;
      try {
        setLoading(true);

        const connectedNetwork = await library?.getNetwork();
        if (!connectedNetwork)
          throw new Error('Could not get network information');

        if (!supportedChains.has(connectedNetwork?.chainId)) {
          setError({
            message: `Unsupported network${connectedNetwork?.chainId}`,
          });
          return;
        } else setError(undefined);

        const [
          allowanceReturned,
          symbolReturned,
          balanceReturned,
          decimalsReturned,
        ] = await Promise.allSettled([
          erc20.allowance(account, metaTxProxy.address),
          erc20.symbol(),
          erc20.balanceOf(account),
          erc20.decimals(),
        ]);
        setAllowance(allowanceReturned);
        setSymbol(symbolReturned);
        setBalance(balanceReturned);
        setDecimals(decimalsReturned);
      } catch (error) {
        setError(error);
      } finally {
        console.info('Setting loading false');
        setLoading(false);
      }
    })();
  }, [account, chainId, erc20, library, metaTxProxy, setError, setLoading]);

  // Poll Token/BRL rate.
  const [tokenBRLRate, setTokenBRLRate] = useState('0');
  useInterval(async () => {
    setTokenBRLRate(await fetchTokenRate());
  }, pollPeriod);

  const increaseAllowance = useCallback(async () => {
    if (!erc20 || !metaTxProxy) return;
    const tx = await erc20.approve(
      metaTxProxy.address,
      '1000000000000000000000000000000000000000'
    );
    await tx.wait();
    setAllowance(await erc20.allowance(account, metaTxProxy.address));
  }, [account, erc20, metaTxProxy]);

  return {
    increaseAllowance,
    allowance,
    symbol,
    balance,
    tokenBRLRate,
    error,
    loading,
    decimals,
    contract: erc20,
  };
}
