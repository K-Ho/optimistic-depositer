# Optimistic Depositer

Sends a deposit tx of a 1/10^18 of an SNX to the Optimism Goerli testnet. First, install dependencies with 
```
yarn
```
Set up your `.env`:
```
cp .env.example .env
```
Add in the private key for your account which must have some L1 Goerli SNX as well as some Goerli ETH. Also add your infura url (or other L1 Goerli endpoint).

Then run 
```
node index.js
```
