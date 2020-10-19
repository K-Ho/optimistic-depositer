'use strict';

const { gray, green, red } = require('chalk');
const snx = require('synthetix');
const { Watcher } = require('@eth-optimism/watcher')

const {
	Contract,
	providers: { JsonRpcProvider },
	Wallet,
} = require('ethers');

const optimismURL = process.env.L2_URL
const goerliURL = process.env.L1_URL
const network = 'goerli'
const l2Provider = new JsonRpcProvider(optimismURL)
const l1Provider = new JsonRpcProvider(goerliURL)

const secondaryDepositAbi = snx.getSource({ network, contract: 'SecondaryDeposit' }).abi
const proxyERC20Abi = snx.getSource({ network, contract: 'ProxyERC20' }).abi

const l1Wallet = new Wallet(process.env.USER_PRIVATE_KEY, l1Provider)
const l2Wallet = new Wallet(process.env.USER_PRIVATE_KEY, l2Provider)
const l1SynthetixDeposit = new Contract(process.env.L1_DEPOSIT_CONTRACT_ADDRESS, secondaryDepositAbi, l1Provider)
const l1ProxyERC20 = new Contract(process.env.L1_ERC20_ADDRESS, proxyERC20Abi, l1Provider)
const l2ProxyERC20 = new Contract(process.env.L2_ERC20_ADDRESS, proxyERC20Abi, l2Provider)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let watcher

const initWatcher = () => {
	watcher = new Watcher({
		l1: {
			provider: l1Provider,
			messengerAddress: process.env.L1_MESSENGER_ADDRESS
		},
		l2: {
			provider: l2Provider,
			messengerAddress: process.env.L2_MESSENGER_ADDRESS
		}
	})
}
const deposit = async (amount) => {
	let l1Balance = await l1ProxyERC20.balanceOf(l1Wallet.address)
	console.log(green('Starting L1 SNX balance:', l1Balance))
	let l2Balance = await l2ProxyERC20.balanceOf(l2Wallet.address)
	console.log(green('Starting L2 SNX balance:', l2Balance))

	const approveTx = await l1ProxyERC20.connect(l1Wallet).approve(l1SynthetixDeposit.address, amount)
	await l1Provider.waitForTransaction(approveTx.hash)
	console.log(green('Approve tx complete: https://goerli.etherscan.io/tx/' + approveTx.hash))
	await sleep(3000)
	const startTime = Date.now()
	const depositTx = await l1SynthetixDeposit.connect(l1Wallet).deposit(amount)
	await l1Provider.waitForTransaction(depositTx.hash)
	console.log(green('Deposit of SNX initiated: https://goerli.etherscan.io/tx/' + depositTx.hash))
	const [messageHash] = await watcher.getMessageHashesFromL1Tx(depositTx.hash)
	console.log('L1->L2 message hash:', messageHash)

	console.log(gray('Waiting for deposit to complete. This will take a few minutes...'))
	const l2TxReceipt = await watcher.getL2TransactionReceipt(messageHash)
	console.log('Deposit completed: https://l2-explorer.surge.sh/tx/' + l2TxReceipt.transactionHash)
	l1Balance = await l1ProxyERC20.balanceOf(l1Wallet.address)
	console.log(green('Ending L1 SNX balance:', l1Balance))
	l2Balance = await l2ProxyERC20.balanceOf(l2Wallet.address)
	console.log(green('Ending L2 SNX balance:', l2Balance))
	console.log('Time to perform deposit:', ((Date.now() - startTime) / (1000 * 60)).toFixed(1), 'minutes')
}

async function runner() {
	try {
		initWatcher()
		await deposit(1)
	} catch (err) {
		console.error(red('Error detected:', err))
	}
}

module.exports = runner
