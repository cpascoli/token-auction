import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";

import { deployAuctionContract, startAuction, submitBids, waitSeconds, toWei, toUnits, day } from "./helpers";

/**
 * Tests for the sendEther function in the TokenAuction contract.
 */
describe("TokenAuction", function () {

    describe("sendEther()", function () {

        describe("validation", function () {

            it("reverts when caller is not the owner", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));
                
                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount });
                
                await expect( tokenAuction.connect(user).sendEther(user.address, etherAmount) ).to.be.revertedWith("TokenAuction: caller is not the owner");
            });

            it("reverts when the auction is in progress", async function () {
                const { tokenAuction, testToken, owner, user } = await loadFixture(deployAuctionContract);
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day)

                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));
                
                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount });

                await expect( tokenAuction.connect(owner).sendEther(owner.address, etherAmount) ).to.be.revertedWith("TokenAuction: auction in progress");
            });

            it("reverts when the auction has not filled all winning bids", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ owner, user0, user1, user2 ] = await ethers.getSigners();
   
                // start an auction
                await startAuction(tokenAuction, testToken, toWei(30), 7 * day);
                const users = [user0, user1, user2];
                const prices = [1, 1, 1];
                const amounts = [toWei(10), toWei(10), toWei(10)];

                await submitBids(tokenAuction, users, amounts, prices);

                // end auction and fill 2 out 3 bids
                await waitSeconds(7 * day);
                await tokenAuction.connect(user0).endAuction(2);

                await expect( tokenAuction.connect(owner).sendEther(owner.address, 1) ).to.be.revertedWith("TokenAuction: winning bids not filled");
            });

            it("reverts when the destination address is the 0x0 address", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ owner, user ] = await ethers.getSigners();
   
                // start an auction and submit bids
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));
                
                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount });

                await waitSeconds(7 * day);
                await tokenAuction.connect(user).endAuction(0);

                await expect( tokenAuction.connect(owner).sendEther(ethers.constants.AddressZero, etherAmount) ).to.be.revertedWith("TokenAuction: invalid recipient address");
            });

            it("reverts when the Ether amount is greater than the contract balance", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ owner, user ] = await ethers.getSigners();
   
                // start an auction and submit bids
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));
                
                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount });

                await waitSeconds(7 * day);
                await tokenAuction.connect(user).endAuction(0);

                // an amount 1 wei greater than the contract ether balance
                const withdrawAmount = (await tokenAuction.getBalance()).add(1);

                await expect( tokenAuction.connect(owner).sendEther(owner.address, withdrawAmount) ).to.be.revertedWith("TokenAuction: invalid amount");
            });
        })


        describe("processing", function () {

            it("sends Ether to the destination address", async function () {
                const { tokenAuction, testToken, owner, user } = await loadFixture(deployAuctionContract);
   
                // start an auction and submit a bid
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));
                
                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount });

                await waitSeconds(7 * day);
                await tokenAuction.connect(user).endAuction(0);

                // withdraw all Ether from the contract
                const etherWithdrawn = await tokenAuction.getBalance();
                const balanceBefore = await ethers.provider.getBalance(owner.address);
                
                const tx = await tokenAuction.connect(owner).sendEther(owner.address, etherWithdrawn);

                const balanceAfter = await ethers.provider.getBalance(owner.address);
                const etherReceived = balanceAfter.sub(balanceBefore);

                // calculate the cost of the sendEther transaction
                const receipt = await tx.wait();
                const gasUsed = receipt.gasUsed;
                const txGasCost = gasUsed.mul(tx.gasPrice!);

                expect( await tokenAuction.getBalance() ).to.be.equal( toWei(0) );
                expect( etherReceived ).to.be.equal( etherWithdrawn.sub(txGasCost) );
            });


            it("emits the EtherSent event", async function () {
                const { tokenAuction, testToken, owner, user } = await loadFixture(deployAuctionContract);
   
                // start an auction and submit a bid
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                const amount = toWei(100);
                const price = toWei(0.01);
                const etherAmount = toWei(toUnits(amount) * toUnits(price));
                
                await tokenAuction.connect(user).bid(amount, price, { value: etherAmount });

                await waitSeconds(7 * day);
                await tokenAuction.connect(user).endAuction(0);
              
                await expect( tokenAuction.connect(owner).sendEther(owner.address, etherAmount) )
                    .to.emit(tokenAuction, 'EtherSent')
                    .withArgs(owner.address, etherAmount);
            });
        })

    })

});