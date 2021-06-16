import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Blockies from 'react-blockies';
import { ethers } from 'ethers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import QrReader from 'react-qr-reader';
import Confetti from 'react-confetti';
import solid from '@fortawesome/fontawesome-free-solid';
import fontawesome from '@fortawesome/fontawesome';
import useWindowSize from 'react-use/lib/useWindowSize';
import erc20Abi from './abis/erc20.ovm.json';
import Title from 'antd/lib/typography/Title';
import {
  Card,
  Button,
  Spin,
  Skeleton,
  notification,
  Alert,
  Badge,
  Space,
  Modal,
} from 'antd';
import { CameraOutlined, LoadingOutlined } from '@ant-design/icons';
import Flippy, { FrontSide, BackSide } from 'react-flippy';
import { useDebounce, useInterval, useWallet } from './hooks';
import metaTxProxyAbi from './abis/metaTxProxy.ovm.json';
import { ERC20MetaTransaction } from './utils';
import chains from './connectors/chains.json';
import OptimismLogo from './assets/optimism.png';

fontawesome.library.add(solid);

interface SignRequest {
  from: string;
  to: string;
  tokenContract: string;
  amount: string;
  nonce: number;
  expiry: number;
}
interface BrcodePreview {
  id: string;
  status: string;
  name: string;
  taxId: string;
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  accountType: string;
  allowChange: boolean;
  amount: number;
  reconciliationId: string;
  description: string;
  tokenAmountRequired: string;
  tokenSymbol: string;
}
interface Reader {
  current: { openImageDialog: () => void };
}

enum PaymentRequestStatus {
  created, // Request received and awaits token tx submission.
  submitted, // Token transfer tx submitted, awaiting confirmation.
  confirmed, // Request confirmed and is being processed.
  rejected, // These should be used for failed payments that do not warrant refund.
  failed, // This is pending a refund.
  refunded, // This payment request failed and the client was refunded.
  processing, // Waiting fiat payment.
  success, // Request processed.
}

const paymentStatusToLabel: { [key: string]: string } = {
  [PaymentRequestStatus.created]:
    'Request received and awaits token tx submission.',
  [PaymentRequestStatus.submitted]:
    'Token transfer tx submitted, awaiting confirmation.',
  [PaymentRequestStatus.confirmed]: 'Request confirmed and is being processed.',
  [PaymentRequestStatus.rejected]:
    'These should be used for failed payments that do not warrant refund.',
  [PaymentRequestStatus.failed]: 'This is pending a refund.',
  [PaymentRequestStatus.refunded]:
    'This payment request failed and the client was refunded.',
  [PaymentRequestStatus.processing]: 'Waiting fiat payment.',
  [PaymentRequestStatus.success]: 'Request processed.',
};

const OPTIMISTIC_KOVAN = 69;
const supportedNetworks = new Set([OPTIMISTIC_KOVAN]);

const App = (): JSX.Element => {
  const { width, height } = useWindowSize();
  const reference = useRef();
  const {
    account,
    onConnectWallet,
    chainId,
    library,
    error: walletError,
  } = useWallet();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [error, setError] = useState<any>();
  const [loading, setLoading] = useState<boolean>(false);
  const [unsupportedNetwork, setUnsupportedNetwork] =
    useState<ethers.providers.Network | undefined>();

  // Monitor wallet errors.
  useEffect(() => {
    if (!walletError) return;

    setError(walletError);

    notification['error']({
      message: walletError.name,
      description: walletError.message,
      duration: 0,
    });
  }, [walletError]);

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
  const [brcodePreview, setBrcodePreview] =
    useState<BrcodePreview | undefined>();
  const debouncedBrcode = useDebounce(brcode, 400);
  useEffect(() => {
    (async () => {
      if (!debouncedBrcode) return;

      try {
        const response = await (
          await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/amount-required?brcode=${debouncedBrcode}&tokenAddress=${process.env.REACT_APP_ERC20_ADDRESS}`
          )
        ).json();

        if (response.error) {
          notification['error']({
            message: 'Error fetching amount required',
            description: response.error.message,
            duration: 0,
          });
          setError(response.error);
          return;
        }

        setBrcodePreview(response);
      } catch (error) {
        notification['error']({
          message: 'Error fetching amount required',
          description: error.message,
          duration: 0,
        });
        setError(error);
      }
    })();
  }, [debouncedBrcode]);

  // Fetch user wallet data.
  const [allowance, setAllowance] = useState<ethers.BigNumber | undefined>();
  const [symbol, setSymbol] = useState<string | undefined>();
  const [balance, setBalance] = useState<ethers.BigNumber | undefined>();
  const [ethRate, setETHRate] = useState<string | undefined>();
  const [network, setNetwork] =
    useState<ethers.providers.Network | undefined>();
  useEffect(() => {
    (async () => {
      if (!account || !erc20 || !metaTxProxy || !chainId) return;
      try {
        setLoading(true);
        const connectedNetwork = await library?.getNetwork();
        if (!connectedNetwork) {
          setError({ message: 'Pending network connection...' });
          setLoading(false);
          return;
        }

        setNetwork(connectedNetwork);
        if (!supportedNetworks.has(connectedNetwork?.chainId)) {
          setUnsupportedNetwork(connectedNetwork);
          return;
        } else setUnsupportedNetwork(undefined);

        const [allowanceReturned, symbolReturned, balanceReturned, ethPrices] =
          await Promise.all([
            erc20.allowance(account, metaTxProxy.address),
            erc20.symbol(),
            erc20.balanceOf(account),
            fetch('https://www.mercadobitcoin.net/api/ETH/ticker/'),
          ]);
        setAllowance(allowanceReturned);
        setSymbol(symbolReturned);
        setBalance(balanceReturned);
        setNetwork(connectedNetwork);
        setETHRate((await ethPrices.json()).ticker.last);
      } catch (error) {
        setError(error);
      } finally {
        console.info('Setting loading false');
        setLoading(false);
      }
    })();
  }, [account, chainId, erc20, library, metaTxProxy]);

  const allowanceEnough = useMemo(() => {
    if (!allowance || !brcodePreview) return false;
    const { tokenAmountRequired } = brcodePreview;
    if (!tokenAmountRequired) return;
    return allowance.gte(
      ethers.BigNumber.from(brcodePreview.tokenAmountRequired)
    );
  }, [allowance, brcodePreview]);

  const increaseAllowance = useCallback(async () => {
    if (!erc20 || !brcodePreview || !metaTxProxy) return;
    const tx = await erc20.approve(
      metaTxProxy.address,
      '1000000000000000000000000000000000000000'
    );
    await tx.wait();
    setAllowance(await erc20.allowance(account, metaTxProxy.address));
  }, [account, brcodePreview, erc20, metaTxProxy]);

  const [paymentRequestSent, setPaymentRequestSent] =
    useState<boolean | undefined>();
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
      setPaymentRequestSent(true);
    } catch (error) {
      console.error(
        `Failure!${error && error.message ? `\n\n${error.message}` : ''}`
      );
      setError(error);
      notification['error']({
        message: 'Error',
        description: error.message,
        duration: 0,
      });
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

  // Track payment request status.
  const [paymentState, setPaymentState] = useState();
  const [polling, setPolling] = useState(true);
  const { status: paymentStatusCode } = paymentState || { status: '' };
  useInterval(
    async () => {
      if (paymentStatusCode === PaymentRequestStatus.success.toString()) {
        setPolling(false);
        return;
      }
      if (!brcodePreview || !paymentRequestSent) return;
      setPaymentState(
        await (
          await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/payment-status?id=${brcodePreview?.id}`
          )
        ).json()
      );
    },
    polling ? 2000 : undefined
  );

  // Read PIX invoice QR Code.
  const qrReaderRefeference = useRef<undefined | Reader>(undefined);
  const openImageDialog = useCallback(() => {
    (qrReaderRefeference as unknown as Reader).current.openImageDialog();
  }, [qrReaderRefeference]);
  const onScanError = useCallback((error) => {
    console.error(error);
    setError(error);
    notification['error']({
      message: 'Error scanning invoice',
      description: error.message,
      duration: 0,
    });
  }, []);
  const onScanSuccess = useCallback((result) => {
    setBrcode(result);
  }, []);

  const [hidden, setHidden] = useState(false);
  const tokenBalance = balance
    ? ethers.utils.formatUnits(balance ?? ethers.BigNumber.from(0), 18)
    : '0.00';
  const normalizedAccount =
    account && `${account.slice(0, 5)}...${account.slice(-3)}`;

  const switchTo = useCallback(
    (chainId) => async () => {
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

  return (
    <div
      style={{
        display: 'flex',
        padding: '32px 24px',
        flexDirection: 'column',
        maxWidth: '768px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Space
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '32px',
          }}
        >
          <Title style={{ marginBottom: 0 }}>Cipay</Title>
          <Spin spinning={loading} />
        </Space>
        {network && (
          <Badge
            status="processing"
            text={chains.find((c) => c.chainId === network.chainId)?.name}
          />
        )}
      </div>

      {error && (
        <Alert
          message={error.message || 'Unknown error.'}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />
      )}
      <Flippy
        flipDirection="vertical"
        ref={reference}
        isFlipped={!!account && !unsupportedNetwork}
        flipOnClick={false}
      >
        <FrontSide
          style={{
            color: 'white',
            borderRadius: '12px',
            marginBottom: '32px',
            overflow: 'clip',
            backgroundColor: '#8EC5FC',
            backgroundImage: 'linear-gradient(62deg, #8EC5FC 0%, #E0C3FC 100%)',

            minHeight: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Button
            icon={<CameraOutlined />}
            type="primary"
            size="large"
            shape="round"
            onClick={onConnectWallet}
          >
            Connect Wallet
          </Button>
        </FrontSide>
        <BackSide
          style={{
            color: 'white',
            borderRadius: '12px',
            marginBottom: '32px',
            overflow: 'clip',
            backgroundColor: '#4158D0',
            backgroundImage:
              'linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)',
            minHeight: '200px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '32px', margin: 0 }}>
                  {hidden ? (
                    <Skeleton.Button />
                  ) : (
                    <>
                      {tokenBalance.slice(0, tokenBalance.indexOf('.') + 5)} Ξ
                    </>
                  )}
                </p>
                <div>
                  {hidden || !balance || !ethRate ? (
                    <Skeleton.Button size="small" style={{ margin: 0 }} />
                  ) : (
                    <p style={{ color: '#ffffff78' }}>
                      R${' '}
                      {Number(ethers.utils.formatEther(balance)) *
                        Number(ethRate)}
                    </p>
                  )}
                </div>
              </div>
              <button
                style={{
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  height: 'min-content',
                }}
                onClick={() => setHidden((previous) => !previous)}
              >
                {hidden ? (
                  <FontAwesomeIcon color="white" icon="eye-slash" />
                ) : (
                  <FontAwesomeIcon color="white" icon="eye" />
                )}
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {normalizedAccount && <p>{normalizedAccount}</p>}
              <Card
                style={{
                  overflow: 'clip',
                  width: '46px',
                  height: '46px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {account && <Blockies seed={account.toLowerCase()} />}
              </Card>
            </div>
          </div>
        </BackSide>
      </Flippy>

      <div>
        {!brcode && !!account && (
          <div>
            <QrReader
              ref={qrReaderRefeference}
              style={{ display: 'none' }}
              onError={onScanError}
              onScan={onScanSuccess}
              showViewFinder={false}
              legacyMode
            />
            <Button
              icon={<CameraOutlined />}
              type="primary"
              size="large"
              shape="round"
              onClick={openImageDialog}
            >
              Capture QR Code
            </Button>
          </div>
        )}
        {brcodePreview && (
          <Card
            loading={!!brcode && !brcodePreview && !error}
            style={{ margin: '24px 0', padding: '24px' }}
          >
            <div>Invoice Due: {brcodePreview?.amount} BRL</div>
            <div>
              You will be charged{' '}
              {ethers.utils.formatUnits(brcodePreview?.tokenAmountRequired, 18)}{' '}
              {symbol}
            </div>
          </Card>
        )}
        {paymentState && (
          <Card style={{ margin: '24px 0', padding: '24px' }}>
            <div>
              Payment status: {paymentStatusToLabel[String(paymentStatusCode)]}
            </div>
          </Card>
        )}
        {brcode && (
          <Card style={{ marginTop: '24px' }}>
            {!account && <Button onClick={onConnectWallet}>Connect</Button>}
            {account && !allowanceEnough && brcodePreview && (
              <Button onClick={increaseAllowance}>Unlock tokens</Button>
            )}
            {account && allowanceEnough && !paymentRequestSent && (
              <Button onClick={onRequestPay}>Pay</Button>
            )}
          </Card>
        )}
      </div>

      {!error && paymentRequestSent && paymentStatusCode !== '7' && (
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
      )}
      {paymentStatusCode === '7' && <Confetti width={width} height={height} />}
      <Modal
        title="Hop onto fast Ethereum ⚡"
        visible={!!unsupportedNetwork}
        maskClosable={false}
        footer={null}
        closable={false}
        bodyStyle={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
        }}
      >
        <p>Please switch to a supported network</p>
        <Space>
          <Button
            onClick={switchTo(OPTIMISTIC_KOVAN)}
            style={{ width: 100, height: 100 }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <img
                src={OptimismLogo}
                alt="Optimism logo"
                width={40}
                height={40}
                style={{ objectFit: 'contain', marginBottom: '8px' }}
              />
              Optimism
            </div>
          </Button>
        </Space>
      </Modal>
    </div>
  );
};

export default App;
