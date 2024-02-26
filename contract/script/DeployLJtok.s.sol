// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import {Script} from "forge-std/Script.sol";
import {LJtok} from "../src/LJtok.sol";

contract DeployLJtok is Script {
    function run() external returns (LJtok) {
        vm.startBroadcast();
        LJtok ljtok = new LJtok();
        vm.stopBroadcast();
    }
}
