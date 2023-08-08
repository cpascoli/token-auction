import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract } from "ethers";

import { deployAuctionContract, startAuction, toWei, day, waitSeconds, toUnits, getLastBlockTimestamp } from "./helpers";


describe("TokenAuction", function () {

    describe("bid", function () {

        describe("validation", function () {

            it("reverts when caller is the owner", async function () {
                const { tokenAuction, testToken, owner } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);

                await expect( tokenAuction.connect(owner).bid(amount, price) ).to.be.revertedWith("TokenAuction: caller is the owner");
            });

            it("reverts if the auction has not started", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                
                const amount = toWei(100);
                const price = toWei(0.01);

                await expect( tokenAuction.connect(user).bid(amount, price) ).to.be.revertedWith("TokenAuction: auction not started");
            });

            it("reverts if the auction ended", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                await waitSeconds(7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                await expect( tokenAuction.connect(user).bid(amount, price) ).to.be.revertedWith("TokenAuction: auction ended");
            });

            it("records a bid when caller is not the owner", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                await tokenAuction.connect(user).bid(amount, price) 

                await expect( await tokenAuction.bidsCount() ) .to.be.equal(1);
            });

        });


        describe("ordering", function () {

            it("records 2 bids in ascending order for increasing bid prices", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const prices = [0.1, 0.2]
                const bidPrices = (await submitBids(tokenAuction, user, amount, prices)).map( it => it.price ) 
                const expectedPrices = prices.sort( (a, b) =>  a < b ? -1 : 1)

                await expect( bidPrices ).to.eql( expectedPrices );
            })

            it("records 2 bids in ascending order for decreasing bid prices", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const prices = [0.3, 0.2]
                const bidPrices = (await submitBids(tokenAuction, user, amount, prices)).map( it => it.price ) 
                const expectedPrices = prices.sort( (a, b) =>  a < b ? -1 : 1)

                await expect( bidPrices ).to.eql( expectedPrices );
            })

            it("records multiple bids in order of ascending price", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const prices = [5, 2, 1, 1, 1, 2, 2, 2.1, 0.1, 1, 2]
                const bidPrices = (await submitBids(tokenAuction, user, amount, prices)).map( it => it.price ) 
                const ascendingPrices = prices.sort( (a, b) =>  a < b ? -1 : 1)

                await expect( bidPrices ).to.eql( ascendingPrices );
            });

            it("records multiple bids for the same price in reverse chronological order", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const prices = [2, 1, 3, 1, 1, 2, 2, 2.1, 0.1, 1, 2]
                const bidsTimestamps = (await submitBids(tokenAuction, user, amount, prices))
                    .filter( it => it.price === 2 )
                    .map( it => it.timestamp )

                await expect( isSortedDescending(bidsTimestamps) ).to.be.true
            })

            it("emits the BidSubmitted event", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(1000);
                const price = toWei(1.1);
    
                const blockTimestampBeforeAcutionStart = await getLastBlockTimestamp()
    
                await expect( await tokenAuction.connect(user).bid(amount, price) )
                    .to.emit(tokenAuction, 'BidSubmitted')
                    .withArgs(user.address, amount, price);
            });
        })


    })

});


type Bid = { price: number, timestamp: number }

/**
 * 
 * @param tokenAuction the TokenAuction contract
 * @param user the account that is submitting the bid
 * @param amount the amount of the token to bid for
 * @param prices the array of prices for the bids to submit, in wei
 * @returns an array of Bid objects containing the price and timestamp of all bids stored in the contract
 */
const submitBids = async (
        tokenAuction: Contract, 
        user: SignerWithAddress, 
        amount: BigNumber, 
        prices: number[]
    ) => {

    for (var price of prices) {
        await tokenAuction.connect(user).bid(amount, toWei(price))
    }

    const bids : Bid[] = (await tokenAuction.getAllBids()).map( 
        (it : { price: BigNumber, timestamp: BigNumber }) => { 
            return {
                price: toUnits(it.price),
                timestamp: it.timestamp.toNumber(),
            }
        }
    );

    return bids;
}



/**
 * Verify that the input array of numbers is sorted in descending order 
 * @param arr an array of numbers
 * @returns if the array is sorted in descending order
 */
const isSortedDescending = (arr: number[]) => {
    for(let i = 1; i < arr.length; i++) {
        if (arr[i-1] < arr[i]) {
            return false;
        }
    }
    return true;
}