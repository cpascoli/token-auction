# Token Auctions

A simple auction contract for ERC20 tokens.
The repo includes a Solidity contract, TokenAuction.sol, that allows to auciton a certain amount of ERC20 tokens to bidders.

The contract includes:

1. A function to start the auction with a quantity of ERC20 tokens and a duration for the auction. This function is accessible to the contract owner. 
2. A function to allow users to place bids on tokens. This function is accessible to non-owner users.
3. A function to end the auction and fill the bids.


## Install Dependencies

```shell
brew install node                # Install Node (MacOS with Homebrew)
npm install                      # Install dependencies

```

##  Run Tests
```shell
npx hardhat test
```

## Generate Docs
```shell
npx hardhat docgen
```