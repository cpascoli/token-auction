import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { 
    deployAuctionContract, 
    startAuction, 
    submitBids, 
    toWei, 
    day, 
    waitSeconds, 
    getLastBlockTimestamp, 
    isSortedDescending 
} from "./helpers";


/**
 * Tests the bid function of the TokenAuction contract.
 */
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

            it("reverts when the auction is not started", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                
                const amount = toWei(100);
                const price = toWei(0.01);

                await expect( tokenAuction.connect(user).bid(amount, price) ).to.be.revertedWith("TokenAuction: auction not started");
            });

            it("reverts when the auction is ended", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                await waitSeconds(7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                await expect( tokenAuction.connect(user).bid(amount, price) ).to.be.revertedWith("TokenAuction: auction ended");
            });

            it("stores a bid when caller is not the owner", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                await tokenAuction.connect(user).bid(amount, price) 

                expect( await tokenAuction.bidsCount() ) .to.be.equal(1);
            });

        });


        describe("ordering", function () {

            it("records bids in ascending order for 2 bids of increasing bid prices", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const prices = [0.1, 0.2]
                const bidPrices = (await submitBids(tokenAuction, [user, user], [amount], prices)).map( it => it.price ) 
                const expectedPrices = prices.sort( (a, b) =>  a < b ? -1 : 1)

                expect( bidPrices ).to.eql( expectedPrices );
            })

            it("records bids in ascending order for 2 bids of decreasing bid prices", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const prices = [0.3, 0.2]
                const bidPrices = (await submitBids(tokenAuction, [user, user], [amount], prices)).map( it => it.price ) 
                const expectedPrices = prices.sort( (a, b) =>  a < b ? -1 : 1)

                expect( bidPrices ).to.eql( expectedPrices );
            })

            it("records bids in ascending order for multiple bids of unsorted prices", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const prices = [5, 2, 1, 1, 1, 2, 2, 2.1, 0.1, 1, 2]
                const users = Array(prices.length).fill(user)
                const bidPrices = (await submitBids(tokenAuction, users, [amount], prices)).map( it => it.price ) 
                const ascendingPrices = prices.sort( (a, b) =>  a < b ? -1 : 1)

                expect( bidPrices ).to.eql( ascendingPrices );
            });

            it("records multiple bids for the same price in reverse chronological order", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const prices = [2, 1, 3, 1, 1, 2, 2, 2.1, 0.1, 1, 2]
                const users = Array(prices.length).fill(user)
                const bidsTimestamps = (await submitBids(tokenAuction, users, [amount], prices))
                    .filter( it => it.price === 2 )
                    .map( it => it.timestamp )

                expect( isSortedDescending(bidsTimestamps) ).to.be.true
            })

            it("emits the BidSubmitted event", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(1000);
                const price = toWei(1.1);
    
                const blockTimestampBeforeAcutionStart = await getLastBlockTimestamp()
    
                expect( await tokenAuction.connect(user).bid(amount, price) )
                    .to.emit(tokenAuction, 'BidSubmitted')
                    .withArgs(user.address, amount, price);
            });
        })


    })

});
