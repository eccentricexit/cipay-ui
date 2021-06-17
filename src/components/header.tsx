import { Badge, Space, Spin } from 'antd';
import Title from 'antd/lib/typography/Title';
import { useWallet } from '../hooks';
import chains from '../connectors/chains.json';

function Header({ loading }: { loading: undefined | boolean }) {
  const { chainId } = useWallet();
  return (
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
      {chainId && (
        <Badge
          status="processing"
          text={chains.find((c) => c.chainId === chainId)?.name}
        />
      )}
    </div>
  );
}

export default Header;
