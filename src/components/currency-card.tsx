import { useRef, useState } from 'react';
import Blockies from 'react-blockies';
import { ethers } from 'ethers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Card, Button, Skeleton } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import Flippy, { FrontSide, BackSide } from 'react-flippy';
import { useWallet } from '../hooks';

function CurrencyCard({
  balance,
  tokenBRLRate,
  decimals,
}: {
  balance: ethers.BigNumber | unknown;
  tokenBRLRate: ethers.BigNumber | unknown;
  decimals: ethers.BigNumber | unknown;
}) {
  const reference = useRef();
  const [hidden, setHidden] = useState(false);

  const { account, onConnectWallet, unsupportedNetwork } = useWallet();

  const tokenBalance = balance
    ? ethers.utils.formatUnits(
        (balance as ethers.BigNumberish) ?? ethers.BigNumber.from(0),
        18
      )
    : '0.00';
  const shortAddress =
    account && `${account.slice(0, 5)}...${account.slice(-3)}`;

  return (
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
                  <>{tokenBalance.slice(0, tokenBalance.indexOf('.') + 5)} Ξ</>
                )}
              </p>
              <div>
                {hidden || !balance || !tokenBRLRate ? (
                  <Skeleton.Button size="small" style={{ margin: 0 }} />
                ) : (
                  <p style={{ color: '#ffffff78' }}>
                    R${' '}
                    {Number(
                      ethers.utils.formatUnits(
                        balance as ethers.BigNumberish,
                        decimals as ethers.BigNumberish
                      )
                    ) * Number(tokenBRLRate)}
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
            {shortAddress && <p>{shortAddress}</p>}
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
  );
}

export default CurrencyCard;
