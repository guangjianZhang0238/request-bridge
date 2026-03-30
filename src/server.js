const { loadConfig } = require('./config');
const { startBridge } = require('./bridge');

async function main() {
  try {
    const config = loadConfig();
    await startBridge({ config });
  } catch (err) {
    console.error(`[fatal] ${err.message}`);
    process.exit(1);
  }
}

main();
