import algosdk from 'algosdk';

const testnet = false;
let urlPrefix = '';
if (testnet) {
  urlPrefix = 'testnet.';
}

const algodToken = '';
const algodServer = `https://${urlPrefix}algoexplorerapi.io`;
const algodPort = '';
const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

function recoverAccount(passphrase) {
  const account = algosdk.mnemonicToSecretKey(passphrase);
  return account
}

async function getTransactionParams() {
  const params = await algodClient.getTransactionParams().do();
  params.fee = 1000;
  params.flatFee = true;
  return params
}

function signTransaction(transaction, account) {
  const signedTransaction = transaction.signTxn(account.sk);
  return signedTransaction
}

async function submitTransaction(signedTransaction) {
  try {
    const response = await algodClient.sendRawTransaction(signedTransaction).do();
    const transactionID = response.txId;
    return transactionID
  } catch (e) {
    console.log(e);
  }
}

async function checkPendingTransaction(transactionID) {
  const pendingInfo = await algodClient.pendingTransactionInformation(transactionID).do();
  return pendingInfo
}

async function getStatus() {
  const status = await algodClient.status().do();
  return status
}

async function getStatusAfterBlock(block) {
  const status = await algodClient.statusAfterBlock(block).do();
  return status
}

async function awaitConfirmation(transactionID) {
  const status = await getStatus();
  const timeout = 4;
  const startRound = status['last-round'] + 1;
  const endRound = startRound + timeout;
  let currentRound = startRound;
  while (currentRound < endRound) {
    const pendingInfo = await checkPendingTransaction(transactionID);
    if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
      return pendingInfo;
    } else if (pendingInfo["pool-error"] != null && pendingInfo["pool-error"].length > 0) {
      throw new Error(`Transaction ${transactionID} was rejected — pool error: ${pendingInfo["pool-error"]}`);
    }
    await getStatusAfterBlock(currentRound);
    currentRound++;
  }
  throw new Error(`Transaction ${transactionID} was not confirmed after ${timeout} rounds`);
}

async function submitAndConfirmTransaction(signedTransaction) {
  const transactionID = await submitTransaction(signedTransaction);
  const pendingInfo = await awaitConfirmation(transactionID);
  pendingInfo.txID = transactionID;
  return pendingInfo
}

async function modifyAsset(configInfo, managerAccount) {
  const transaction = algosdk.makeAssetConfigTxnWithSuggestedParams(
    managerAccount.addr,
    new Uint8Array(Buffer.from(configInfo.note, 'utf8')),
    configInfo.assetID,
    configInfo.managerAddress,
    configInfo.reserveAddress,
    configInfo.freezeAddress,
    configInfo.clawbackAddress,
    configInfo.params,
    configInfo.strictEmptyAddressChecking);
  const signedTransaction = signTransaction(transaction, managerAccount);
  const pendingInfo = await submitAndConfirmTransaction(signedTransaction);
  return pendingInfo
}

async function removeFreezeClawback() {
  const assetID = 12345678; // EDIT: enter your asset ID here
  const managerPassphrase = 'this is where your twenty five word secret phrase goes in all lowercase with spaces in between each word and no mispellings'; // EDIT: enter your mnemonic passphrase here
  const managerAccount = recoverAccount(managerPassphrase);
  const params = await getTransactionParams();
  const configInfo = {
    note: 'Removing freeze and clawback',
    assetID: assetID,
    managerAddress: managerAccount.addr,
    reserveAddress: managerAccount.addr,
    freezeAddress: undefined,
    clawbackAddress: undefined,
    params: params,
    strictEmptyAddressChecking: false
  };
  const pendingInfo = await modifyAsset(configInfo, managerAccount);
  console.log(pendingInfo);
}

removeFreezeClawback()