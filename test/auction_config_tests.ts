import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { deployAuctionContract, toUnits, toWei } from "./helpers";


describe("TokenAuction", function () {


    describe("Config", function () {

		it("has TestToken address", async function () {
			const { testToken } = await loadFixture(deployAuctionContract);

            expect( testToken.address ).to.be.not.undefined
		});

        it("has TokenAuction address", async function () {
			const { tokenAuction } = await loadFixture(deployAuctionContract);

            expect( tokenAuction.address ).to.be.not.undefined
		});


        it("TestToken supply is 1M", async function () {
			const { testToken } = await loadFixture(deployAuctionContract);

            const supply = toUnits(await testToken.totalSupply());
            expect( supply ).to.equals( 1_000_000 )
		});
    })

});