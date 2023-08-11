import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";

import { deployAuctionContract, startAuction, submitBids, waitSeconds, toWei, toUnits, day } from "./helpers";

/**
 * Tests for the configuration of the TokenAuction contract.
 */
describe("TokenAuction", function () {

    describe("withdraw()", function () {

        describe("validation", function () {
            it("reverts when the auction is in progress", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));
                
                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount }) 

                await expect( tokenAuction.connect(user).withdraw() ).to.be.revertedWith("TokenAuction: auction in progress");
            });

            it("reverts when the auction has not filled all winning bids", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ _, user0, user1, user2 ] = await ethers.getSigners();
   
                // start an auction
                await startAuction(tokenAuction, testToken, toWei(30), 7 * day);
                const users = [user0, user1, user2];
                const prices = [1, 1, 1]
                const amounts = [toWei(10), toWei(10), toWei(10)]

                await submitBids(tokenAuction, users, amounts, prices)

                // end auction and fill 2 out 3 bids
                await waitSeconds(7 * day);
                await tokenAuction.connect(user0).endAuction(2);

       
                await expect( tokenAuction.connect(user2).withdraw() ).to.be.revertedWith("TokenAuction: winning bids not filled");
            });


            it("reverts when the bidder has no Ether to withdraw", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ _, user0, user1, user2 ] = await ethers.getSigners();
   
                // start an auction
                await startAuction(tokenAuction, testToken, toWei(30), 7 * day);
                const users = [user0, user1, user2];
                const prices = [1, 1, 1]
                const amounts = [toWei(10), toWei(10), toWei(10)]

                await submitBids(tokenAuction, users, amounts, prices)

                // end auction and fill all bids
                await waitSeconds(7 * day);
                await tokenAuction.connect(user0).endAuction(0);
       
                await expect( tokenAuction.connect(user2).withdraw() ).to.be.revertedWith("TokenAuction: no funds to withdraw");
            });
        })


        describe("processing", function () {

            it("returns Ether to the bidder when they have unfilled bids", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ _, user0, user1, user2 ] = await ethers.getSigners();
   
                // start an auction
                await startAuction(tokenAuction, testToken, toWei(40), 7 * day);

                // users place their bids
                const users = [user0, user0, user1, user2];
                const prices = [1, 1, 2, 3];
                const amounts = [toWei(10), toWei(20), toWei(20), toWei(20)];
                await submitBids(tokenAuction, users, amounts, prices);

                // end the auction, user0 has 2 unfilled bids
                await waitSeconds(7 * day);
                await tokenAuction.connect(user0).endAuction(0);

                // check Ether balance 
                const balanceBeforeWithdraw = await ethers.provider.getBalance(user0.address);

                // withdraw all Ether 
                const tx = await tokenAuction.connect(user0).withdraw();

                // calculate the Ether received by user0
                const balanceAfterWithdraw = await ethers.provider.getBalance(user0.address);
                const user0EtherReceived = balanceAfterWithdraw.sub(balanceBeforeWithdraw);

                // calculate the cost of the withdraw transaction
                const receipt = await tx.wait();
                const gasUsed = receipt.gasUsed;
                const txGasCost = gasUsed.mul(tx.gasPrice!);

                // the expected Ether recieved net of the withdraw transaction cost
                const bid0Value = amounts[0].mul(prices[0]);
                const bid1Value = amounts[1].mul(prices[1]);
                const expectedEtherReceived = bid0Value.add(bid1Value).sub(txGasCost);

                expect( user0EtherReceived ).to.be.equal( expectedEtherReceived );
            });


            it("emits the EtherWithdrawn event", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ _, user0, user1, user2 ] = await ethers.getSigners();
   
                // start an auction
                await startAuction(tokenAuction, testToken, toWei(40), 7 * day);

                // submit bids
                const users = [user0, user1, user2];
                const prices = [1, 2, 3]
                const amounts = [toWei(20), toWei(20), toWei(20)]

                await submitBids(tokenAuction, users, amounts, prices)

                // end auction, user0 has an unfilled bid
                await waitSeconds(7 * day);
                await tokenAuction.connect(user0).endAuction(0);

                const etherAmount = amounts[0].mul(prices[0])
              
                await expect( tokenAuction.connect(user0).withdraw() )
                    .to.emit(tokenAuction, 'EtherWithdrawn')
                    .withArgs(user0.address, etherAmount);

            });
        })

    })

});