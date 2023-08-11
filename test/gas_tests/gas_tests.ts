import { expect } from "chai";
import { 
    deployAuctionContract, 
    startAuction, 
    getRandomBetween, 
    submitBidsAndGetAvgGas,
    waitSeconds, 
    day,
     toWei 
} from "../helpers";

import gas_limits from "./gas_limits.json"


describe("TokenAuction Gas Tests", function () {

    describe("bid()", function () {

        it("100 bids at increasing prices", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

            const bids = 100;
            const amount = toWei(10);
            let basePrice = 1;

            // submit 100 bids for increasing prices
            const prices = Array.from({ length: bids }, () => basePrice++ / 1000 );
            const avgGasUsed = await submitBidsAndGetAvgGas(prices, amount, user, tokenAuction)
         
            expect( avgGasUsed ).to.lessThan( gas_limits.bid_100_incrasing_bids );
            
        }).timeout(10_000);

        it("10 bids at randomly distributed prices", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

            const bids = 10;
            const amount = toWei(10);

            // submit 10 bids for randomly distributed prices
            const prices = Array.from({ length: bids }, () => getRandomBetween(0.001, 0.01));
            const avgGasUsed = await submitBidsAndGetAvgGas(prices, amount, user, tokenAuction)
            expect( avgGasUsed ).to.lessThan( gas_limits.bid_10_random_bids );
            
        }).timeout(10_000);

        it("100 bids at randomly distributed prices", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
            const bids = 100;
            const amount = toWei(10);

            // submit 100 bids for randomly distributed prices
            const prices = Array.from({ length: bids }, () => getRandomBetween(0.001, 0.01));
            const avgGasUsed = await submitBidsAndGetAvgGas(prices, amount, user, tokenAuction)
            expect( avgGasUsed ).to.lessThan( gas_limits.bid_100_random_bids );
            
        }).timeout(60_000);
    })


    describe("endAuction()", function () {

        it("processed 100 bids", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

            const bids = 100;
            const amount = toWei(10);
            let basePrice = 1;

            // submit 100 bids for increasing prices
            const prices = Array.from({ length: bids }, () => basePrice++ / 10_000 );

            await submitBidsAndGetAvgGas(prices, amount, user, tokenAuction)

            // wait for the end of the auction
            await waitSeconds(7 * day)

            const tx = await tokenAuction.endAuction(0);
            const gasUsed = (await tx.wait()).gasUsed;

            expect( gasUsed ).to.lessThan( gas_limits.end_auction_100_bids );
            
        }).timeout(10_000);
 

        it("processed 1000 bids", async function () {
            const { tokenAuction, testToken, user } = await deployAuctionContract();
            await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

            const bids = 1000;
            const amount = toWei(1);
            let basePrice = 1;

            // submit 1000 bids for increasing prices
            const prices = Array.from({ length: bids }, () => basePrice++ / 100_000 );
            await submitBidsAndGetAvgGas(prices, amount, user, tokenAuction);

            // wait for the end of the auction
            await waitSeconds(7 * day);

            // call endAuction passing batches of 100 until the AuctionEnded event is received
            while(true) {
                const tx = await tokenAuction.endAuction(100);

                // verify gas usage and AuctionEnded from the transaction receipt
                const receipt = await tx.wait();
                expect( receipt.gasUsed ).to.lessThan( gas_limits.end_auction_1000_bids );

                const event = receipt.events && receipt.events[0] ? receipt.events[0] : undefined
                
                if (event?.event === 'AuctionEnded') break;
            }
      
        }).timeout(30_000);
    })


})

