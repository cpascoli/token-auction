import { BigNumber, Contract } from "ethers"
import { expect } from "chai";
import { deployMockContract } from "ethereum-waffle"
import { ethers } from "hardhat";

import { deployAuctionContract, startAuction, submitBids, waitSeconds, day, toWei } from "../helpers";

import gas_limits from "./gas_limits.json"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("TokenAuction Gas Tests", function () {

    describe("bid", function () {

        it("100 bids at increasing prices", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

            const bids = 100;
            const amount = toWei(10);
            let startingPrice = 100;

            // submit 100 bids for increasing prices
            const prices = Array.from({ length: bids }, () => startingPrice++);
            const avgGasUsed = await placeBids(prices, amount, user, tokenAuction)
         
            expect( avgGasUsed ).to.lessThan( gas_limits.bid_100_incrasing_bids );
            
        }).timeout(10_000);

        it("10 bids at randomly distributed prices", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

            const bids = 10;
            const amount = toWei(10);

            // submit 10 bids for randomly distributed prices
            const prices = Array.from({ length: bids }, () => getRandomBetween(0.5, 1.5));
            const avgGasUsed = await placeBids(prices, amount, user, tokenAuction)
            
            expect( avgGasUsed ).to.lessThan( gas_limits.bid_10_random_bids );
            
        }).timeout(10_000);

        it("100 bids at randomly distributed prices", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
            const bids = 100;
            const amount = toWei(10);

            // submit 100 bids for randomly distributed prices
            const prices = Array.from({ length: bids }, () => getRandomBetween(0.5, 1.5));
            const avgGasUsed = await placeBids(prices, amount, user, tokenAuction)

            expect( avgGasUsed ).to.lessThan( gas_limits.bid_100_random_bids );
            
        }).timeout(60_000);
    })


    describe("endAuction", function () {

        it("processed 100 bids", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

            const bids = 100;
            const amount = toWei(10);
            let startingPrice = 100;

            // submit 100 bids for increasing prices
            const prices = Array.from({ length: bids }, () => startingPrice++);
            await placeBids(prices, amount, user, tokenAuction)

            // wait for the end of the auction
            await waitSeconds(7 * day)

            const tx = await tokenAuction.endAuction();
            const gasUsed = (await tx.wait()).gasUsed;
     
            expect( gasUsed ).to.lessThan( gas_limits.end_auction_100_bids );
            
        }).timeout(10_000);
 

        it("processed 1000 bids", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

            const bids = 1000;
            const amount = toWei(10);
            let startingPrice = 100;

            // submit 1000 bids for increasing prices
            const prices = Array.from({ length: bids }, () => startingPrice++);
            await placeBids(prices, amount, user, tokenAuction);

            // wait for the end of the auction
            await waitSeconds(7 * day);

            const tx = await tokenAuction.endAuction();
            const gasUsed = (await tx.wait()).gasUsed;
    
            expect( gasUsed ).to.lessThan( gas_limits.end_auction_1000_bids );
            
        }).timeout(10_000);
    })


})


// 3308627 3308627 3153027  3152901  2549571 1367280

/**
 * @param min the min value (inclusive)
 * @param max the max value (exclusive)
 * @returns Random value between min (inclusive) and max (exclusive)
 */
const getRandomBetween = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
}

/**
 * Submit n bids and returns the average gas spent.
 * 
 * @param prices an array of n prices used to submit n bids
 * @param amount the amount of each bid
 * @param user the user submitting the transactions
 * @param tokenAuction the TokenAuction contract
 * @returns The average gas spent for all tranactions as a Promise<BigNumber>
 */
const placeBids = async (
        prices: number[],
        amount: BigNumber,
        user: SignerWithAddress, 
        tokenAuction: Contract,
    )  => {
    
    let totalGasUsed = BigNumber.from(0);
    for (let i=0; i<prices.length; i++) {
        const tx = await tokenAuction.connect(user).bid(amount, toWei(prices[i]));
        const gasUsed = (await tx.wait()).gasUsed;
        totalGasUsed = totalGasUsed.add(gasUsed);
    }

    return totalGasUsed.div(prices.length).toNumber();
}