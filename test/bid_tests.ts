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
    isSortedDescending, 
    toUnits
} from "./helpers";


/**
 * Tests for the bid function of the TokenAuction contract.
 */
describe("TokenAuction", function () {

    describe("bid()", function () {

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

            it("reverts when the bid amount is 0", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(0);
                const price = toWei(0.01);
                await expect( tokenAuction.connect(user).bid(amount, price) ).to.be.revertedWith("TokenAuction: invalid bid");
            });

            it("reverts when bid price is 0", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(1);
                const price = toWei(0);
                await expect( tokenAuction.connect(user).bid(amount, price) ).to.be.revertedWith("TokenAuction: invalid bid");
            });

            it("reverts when the amount of Ether received is too few", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                // ether amount sent is short 1 wei
                const etherAmount = toWei(toUnits(amount) * toUnits(price)).sub(1);

                await expect( tokenAuction.connect(user).bid(amount, price, { value: etherAmount }) ).to.be.revertedWith("TokenAuction: invalid amount of Ether sent");
            });

            it("reverts when the amount of Ether received is too many", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                // ether amount sent is in excess of 1 wei
                const etherAmount = toWei(toUnits(amount) * toUnits(price)).add(1); 

                await expect( tokenAuction.connect(user).bid(amount, price, { value: etherAmount }) ).to.be.revertedWith("TokenAuction: invalid amount of Ether sent");
            });

        });


        describe("processing", function () {
            it("stores a bid when the caller is not the owner", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));

                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount }) 

                expect( (await tokenAuction.getAllBids()).length ).to.be.equal(1);
            });

            it("receives Ether from the bidder when a bid is stored", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));

                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount }) 

                expect( await tokenAuction.getBalance() ).to.be.equal( etherAmount )
            });

            it("adds Ether to the bidder balance for one bid", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));

                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount }) 

                expect( await tokenAuction.getBidderBalance(user.address) ).to.be.equal( etherAmount )
            });

            it("increments the bidder balance when more bids are received", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
           
                const etherAmount = toWei(toUnits(amount) * toUnits(price));
                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount }) 
                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount }) 

                expect( await tokenAuction.getBidderBalance(user.address) ).to.be.equal( etherAmount.mul(2) )
            });

            it("emits the BidSubmitted event", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(1);
                const price = toWei(1.1);
                const etherAmount = toWei(toUnits(amount) * toUnits(price)); 
    
                await expect( tokenAuction.connect(user).bid(amount, price, { value: etherAmount }) )
                    .to.emit(tokenAuction, 'BidSubmitted')
                    .withArgs(user.address, amount, price);
            });
        })


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

                const amount = toWei(1);
                const prices = [5, 2, 1, 1, 1, 2, 2, 2.1, 0.1, 1, 2];
                const users = Array(prices.length).fill(user)
                const bidPrices = (await submitBids(tokenAuction, users, [amount], prices)).map( it => it.price ) 
                const ascendingPrices = prices.sort( (a, b) =>  a < b ? -1 : 1)

                expect( bidPrices ).to.eql( ascendingPrices );
            });

            it("records multiple bids for the same price in reverse chronological order", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(1);
                const prices = [2, 1, 3, 1, 1, 2, 2, 2.1, 0.1, 1, 2]
                const users = Array(prices.length).fill(user)
                const bidsTimestamps = (await submitBids(tokenAuction, users, [amount], prices))
                    .filter( it => it.price === 2 )
                    .map( it => it.timestamp )

                expect( isSortedDescending(bidsTimestamps) ).to.be.true
            });
        })

    })

});
