import { ethers, upgrades } from "hardhat";

// TokenAuctionV2 deployed on  0xdC7a7693cB57DB09805Ac851A0893685363AD52D
const PROXY = '0x30abB2dfC2A86a77a7D484df7A693A291682845A'

async function main() {
    console.log("Starting upgrade of TokenAuction contract");
    const TokenAuctionV2 = await ethers.getContractFactory("TokenAuctionV2");
    await upgrades.upgradeProxy(PROXY, TokenAuctionV2)
    console.log("TokenAuction upgraded!");
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
