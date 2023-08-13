import { ethers, upgrades } from "hardhat";
import { toWei } from "../test/helpers"

// TransparentUpgradeableProxy 0x30abB2dfC2A86a77a7D484df7A693A291682845A
// TokenAuction: 0xb42f1426123796923b352416399b68f45300af1a
// TestToken: 0xc89B6E0eEeE8f9A4e85b033C3ABBa8Df4ab67026


async function main() {
    // deploy TestToken
    const TestToken = await ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy(toWei(1_000_000));

    console.log("TestToken deployed at address: ", testToken.address);

    // deploy TokenAuction
    const TokenAuction = await ethers.getContractFactory("TokenAuction");
    const tokenAuction = await upgrades.deployProxy(TokenAuction, [testToken.address], {
        initializer: "initialize",
    })

    await tokenAuction.deployed();

    console.log("TokenAuction deployed at address: ", tokenAuction.address);
}



// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
