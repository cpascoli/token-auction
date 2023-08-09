# Token Auction

A simple auction system for ERC20 tokens.
The repo includes the Solidity contract `TokenAuction.sol` that allows to auction a given amount of ERC20 tokens to bidders.

The contract provides the following functionality:

1. A function to start the auction for a specified quantity of ERC20 tokens and duration for the auction. This function is accessible to the contract owner. 
2. A function to allow users to place bids on tokens for a desited amount and price. This function is accessible to non-owner users.
3. A function to end the auction and fill the bids.


## Design decisions and other considerations:
- The contract holds a dynamic array of all bids submitted by the users. This bids array is kept sorted in ascending price order to ease the process of filling the bids when the auction ends.
- This strategy incentivises submitting bids at relatively higher prices because such bids cost less gas than bids submitted at relatively lower prices, given that they require less manipulation of the bids array to keep it sorted.
- The process to end the auction can be triggered only when the duration of the auction has elapsed.
- Effort was focused on extensively testing and documenting the core contract functionality, rather than adding extra features.


## Future Improvements:
- Allow users to raise or cancel their bids before the auction ends.
- Allow to end the auction early when all tokens are sold or a given amount (hardcap) has been raised.
- If by the end of the auction a given amount (softcap) has not been raised all bids are voided and funds can be returned to the users.


## Install Dependencies

```shell
brew install node                # Install Node (MacOS with Homebrew)
npm install                      # Install dependencies

```

## Run Functional Tests
```shell
npm run test
```

## Run Gas Tests
```shell
npm run gas-test
```

## Generate Docs
```shell
npx hardhat docgen
```