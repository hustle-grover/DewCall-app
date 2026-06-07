import { deliverBrief } from '../src/server/services/brief-delivery';

async function main() {
  console.log('Starting delivery test...');
  try {
    await deliverBrief('afb92f7b-7827-463e-9a0f-941b3dc1343b');
    console.log('DONE');
  } catch (err) {
    console.error('ERROR:', err);
  }
}

main();
