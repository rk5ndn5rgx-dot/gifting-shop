const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const PRIVATE_SERVICE_PROTOCOL = process.env.PRIVATE_SERVICE_PROTOCOL || 'http';
const PRIVATE_SERVICE_HOST = process.env.PRIVATE_SERVICE_HOST;
const PRIVATE_SERVICE_PORT = process.env.PRIVATE_SERVICE_PORT;

if (!PRIVATE_SERVICE_HOST || !PRIVATE_SERVICE_PORT) {
  console.error('Environment variables PRIVATE_SERVICE_HOST and PRIVATE_SERVICE_PORT are required.');
  process.exit(1);
}

function getPrivateServiceUrl() {
  return `${PRIVATE_SERVICE_PROTOCOL}://${PRIVATE_SERVICE_HOST}:${PRIVATE_SERVICE_PORT}`;
}

app.get('/', (req, res) => {
  res.send('Stripe webhook proxy is running.');
});

app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const privateUrl = `${getPrivateServiceUrl()}/webhook/stripe`;
    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json'
    };

    if (req.headers['stripe-signature']) {
      headers['Stripe-Signature'] = req.headers['stripe-signature'];
    }

    const response = await fetch(privateUrl, {
      method: 'POST',
      body: req.body,
      headers,
      redirect: 'follow'
    });

    const responseText = await response.text();
    res.status(response.status).send(responseText);
  } catch (err) {
    console.error('Error proxying Stripe webhook:', err);
    res.status(502).send('Bad gateway');
  }
});

app.listen(PORT, () => {
  console.log(`Stripe proxy listening on port ${PORT}`);
  console.log(`Forwarding /webhook/stripe to ${getPrivateServiceUrl()}/webhook/stripe`);
});
