import { useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import solid from '@fortawesome/fontawesome-free-solid';
import fontawesome from '@fortawesome/fontawesome';
import { Button, notification, Alert, Space, Modal } from 'antd';
import { useWallet } from './hooks';
import metaTxProxyAbi from './abis/metaTxProxy.ovm.json';
import { chainIds } from './utils';
import OptimismLogo from './assets/optimism.png';
import PolygonLogo from './assets/polygon-logo.png';
import { CurrencyCard, Header, Payment } from './components';
import useERC20MetaTx from './hooks/erc20';

fontawesome.library.add(solid);

// TODO: Prioritize support for polygon.
// TODO: Support network native currency by including
// the encrypted invoice identifier in the data field.

const App = (): JSX.Element => {
  const {
    library,
    error: walletError,
    switchToChainId,
    unsupportedNetwork,
  } = useWallet();

  const signer = useMemo(() => library?.getSigner(), [library]);
  const metaTxProxy = useMemo(
    () =>
      new ethers.Contract(
        process.env.REACT_APP_META_TX_PROXY_ADDRESS || '',
        metaTxProxyAbi,
        signer
      ),
    [signer]
  );
  const erc20 = useERC20MetaTx(
    process.env.REACT_APP_ERC20_ADDRESS || '',
    metaTxProxy,
    async () => '0'
  );

  // Monitor wallet errors.
  useEffect(() => {
    if (!walletError) return;

    notification['error']({
      message: walletError.name,
      description: walletError.message,
      duration: 0,
    });
  }, [walletError]);

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
      <Header loading={erc20 && erc20.loading} />

      {walletError && (
        <Alert
          message={walletError.message || 'Unknown error.'}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />
      )}

      <CurrencyCard {...erc20} />

      <Payment erc20={erc20.contract} metaTxProxy={metaTxProxy} {...erc20} />

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
            onClick={switchToChainId(chainIds.OPTIMISTIC_KOVAN)}
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
          <Button
            onClick={switchToChainId(chainIds.POLYGON_MUMBAI)}
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
                src={PolygonLogo}
                alt="Optimism logo"
                width={40}
                height={40}
                style={{ objectFit: 'contain', marginBottom: '8px' }}
              />
              Polygon
            </div>
          </Button>
        </Space>
      </Modal>
    </div>
  );
};

export default App;
