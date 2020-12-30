import {
  Provider as BumbagProvider,
  PageContent,
  Input,
  Button,
  Stack,
  Card,
  Flex,
} from 'bumbag'
import { useCallback, useEffect, useState } from 'react'
import { Web3ReactProvider, useWeb3React } from '@web3-react/core'
import { Web3Provider } from '@ethersproject/providers'

import { useEagerConnect, useInactiveListener } from '../hooks'
import { injected } from '../connectors'

enum ConnectorNames {
  Injected = 'Injected',
}

const connectorsByName: { [connectorName in ConnectorNames]: any } = {
  [ConnectorNames.Injected]: injected,
}

function getLibrary(provider: any): Web3Provider {
  const library = new Web3Provider(provider)
  library.pollingInterval = 12000
  return library
}

const IndexPage = () => {
  return (
    <BumbagProvider>
      <Web3ReactProvider getLibrary={getLibrary}>
        <App />
      </Web3ReactProvider>
    </BumbagProvider>
  )
}

const App = () => {
  const { account, active, library, activate, connector } = useWeb3React()

  // handle logic to recognize the connector currently being activated
  const [activatingConnector, setActivatingConnector] = useState<any>()
  useEffect(() => {
    if (activatingConnector && activatingConnector === connector) {
      setActivatingConnector(undefined)
    }
  }, [activatingConnector, connector])

  // handle logic to eagerly connect to the injected ethereum provider, if it exists and has granted access already
  const triedEager = useEagerConnect()

  // handle logic to connect in reaction to certain events on the injected ethereum provider, if it exists
  useInactiveListener(!triedEager || !!activatingConnector)

  const onConnectWallet = useCallback(() => {
    setActivatingConnector(connectorsByName[ConnectorNames.Injected])
    activate(connectorsByName[ConnectorNames.Injected])
  }, [])

  const onRequestPay = useCallback(() => {
    if (!library) return
    library
      .getSigner(account)
      .signMessage('👋')
      .then((signature: any) => {
        window.alert(`Success!\n\n${signature}`)
      })
      .catch((error: any) => {
        window.alert(
          'Failure!' + (error && error.message ? `\n\n${error.message}` : '')
        )
      })
  }, [library, account])

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
  )
}

export default IndexPage
