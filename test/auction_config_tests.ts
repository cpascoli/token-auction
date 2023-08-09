import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { deployAuctionContract, toUnits, toWei } from "./helpers";

/**
 * Tests for the configuration of the TokenAuction contract.
 */
describe("TokenAuction", function () {

    describe("Config", function () {

		it("has TestToken address", async function () {
			const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);

            expect( await tokenAuction.token() ).to.be.not.undefined
            expect( await tokenAuction.token() ).to.equals(testToken.address)
		});
    })

});