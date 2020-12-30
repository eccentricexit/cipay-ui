import {
  Provider as BumbagProvider,
  PageContent,
  Input,
  Button,
  Stack,
  Card,
  Flex,
} from 'bumbag'
import { useCallback, useState } from 'react'

const IndexPage = () => {
  const [isLoading, setIsLoading] = useState<boolean | undefined>()

  const onPayRequest = useCallback(() => {
    setIsLoading(true)
    // TODO: Request signature to send x DAI from
    // TODO: Send QR Code + signature to backend.
    setTimeout(() => setIsLoading(false), 3000)
  }, [])

  return (
    <BumbagProvider>
      <PageContent>
        <Card>
          <Stack>
            <Input placeholder="Enter your the QR code here." />
            <Flex alignX="right">
              <Button
                palette="primary"
                isLoading={isLoading}
                onClick={onPayRequest}
              >
                Pay
              </Button>
            </Flex>
          </Stack>
        </Card>
      </PageContent>
    </BumbagProvider>
  )
}

export default IndexPage
