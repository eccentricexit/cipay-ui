import React, { useCallback, useState } from 'react';
import { Button } from 'ui-neumorphism';
import QRCode from 'qrcode.react';

function Generator() {
  const [error, setError] = useState<unknown>();
  const [brcode, setBrcode] = useState('');
  const generatePixInvoice = useCallback(async () => {
    try {
      const {
        invoice: { brcode },
      } = await (
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/generate-brcode`, {
          method: 'POST',
        })
      ).json();

      setBrcode(brcode);
    } catch (generatePixInvoiceError) {
      setError(generatePixInvoiceError);
    }
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        flexDirection: 'column',
      }}
    >
      {error && JSON.stringify(error)}
      {!brcode && (
        <Button
          bgColor="var(--primary)"
          color="#fff"
          onClick={generatePixInvoice}
        >
          Generate Test Invoice
        </Button>
      )}
      {brcode && (
        <QRCode
          style={{
            margin: 32,
            objectFit: 'contain',
            height: '100%',
            maxWidth: '100%',
          }}
          size={500}
          value={brcode}
        />
      )}
    </div>
  );
}

export default Generator;
