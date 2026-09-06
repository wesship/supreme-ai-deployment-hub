// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IStateView} from "@uniswap/v4-periphery/src/interfaces/IStateView.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";

interface IERC20Minimal {
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

interface IPermit2Allowance {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

/// @notice D3VONN fork-only V4 mutation harness.
/// @dev This test never broadcasts. It uses Foundry cheatcodes to fund a disposable
///      test actor on a pinned Base fork and validates PositionManager state changes.
contract D3VONNLiquidityV4ForkTest is Test {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    address internal constant POOL_MANAGER = 0x498581ff718922c3f8e6a244956af099b2652b2b;
    address internal constant POSITION_MANAGER = 0x7c5f5a4bbd8fd63184577525326123b519429bdc;
    address internal constant STATE_VIEW = 0xa3c0c9b65bad0b08107aa264b0f3db444b867a71;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    IPositionManager internal lpm = IPositionManager(POSITION_MANAGER);
    IStateView internal stateView = IStateView(STATE_VIEW);

    PoolKey internal key;
    PoolId internal expectedPoolId;
    address internal actor;
    int24 internal tickLower;
    int24 internal tickUpper;
    uint256 internal gasCeiling;

    event SimulationMetric(string indexed scenario, uint256 gasUsed, uint256 liquidityBefore, uint256 liquidityAfter);

    function setUp() public {
        string memory rpc = vm.envString("LIQUIDITY_BASE_RPC_URL");
        uint256 forkBlock = vm.envUint("D3VONN_V4_FORK_BLOCK");
        vm.createSelectFork(rpc, forkBlock);
        assertEq(block.chainid, 8453, "wrong fork chain");

        expectedPoolId = PoolId.wrap(vm.envBytes32("D3VONN_V4_POOL_ID"));
        Currency currency0 = Currency.wrap(vm.envAddress("D3VONN_V4_CURRENCY0"));
        Currency currency1 = Currency.wrap(vm.envAddress("D3VONN_V4_CURRENCY1"));
        uint24 fee = uint24(vm.envUint("D3VONN_V4_FEE"));
        int24 tickSpacing = int24(int256(vm.envInt("D3VONN_V4_TICK_SPACING")));
        IHooks hooks = IHooks(vm.envOr("D3VONN_V4_HOOKS", address(0)));
        tickLower = int24(int256(vm.envInt("D3VONN_V4_TICK_LOWER")));
        tickUpper = int24(int256(vm.envInt("D3VONN_V4_TICK_UPPER")));
        gasCeiling = vm.envOr("D3VONN_V4_GAS_CEILING", uint256(3_000_000));

        key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: hooks
        });

        assertEq(PoolId.unwrap(key.toId()), PoolId.unwrap(expectedPoolId), "PoolKey/PoolId mismatch");
        assertEq(address(stateView.poolManager()), POOL_MANAGER, "StateView manager mismatch");
        assertEq(address(lpm.poolManager()), POOL_MANAGER, "PositionManager manager mismatch");

        (uint160 sqrtPriceX96, int24 currentTick,,) = stateView.getSlot0(expectedPoolId);
        assertGt(uint256(sqrtPriceX96), 0, "pool not initialized");
        assertLe(tickLower, currentTick, "current tick below range");
        assertLt(currentTick, tickUpper, "current tick above range");

        // V0.4 mutation scenarios are intentionally ERC20/ERC20 only.
        assertTrue(Currency.unwrap(currency0) != address(0), "native currency mutation disabled");
        assertTrue(Currency.unwrap(currency1) != address(0), "native currency mutation disabled");

        actor = makeAddr("D3VONN_V4_TEST_ACTOR");
    }

    function test_readOnlyCanonicalState() public view {
        (uint160 sqrtPriceX96,,, uint24 lpFee) = stateView.getSlot0(expectedPoolId);
        uint128 liquidity = stateView.getLiquidity(expectedPoolId);
        require(sqrtPriceX96 > 0, "zero sqrt price");
        require(lpFee <= type(uint24).max, "invalid lp fee");
        require(liquidity >= 0, "invalid liquidity");
    }

    function test_forkOnlyPositionLifecycle() public {
        if (!vm.envOr("D3VONN_V4_MUTATION_TESTS", false)) return;

        uint256 seedAmount = vm.envOr("D3VONN_V4_SEED_AMOUNT", uint256(1e24));
        uint256 initialLiquidity = vm.envOr("D3VONN_V4_INITIAL_LIQUIDITY", uint256(1e12));
        uint256 deltaLiquidity = vm.envOr("D3VONN_V4_DELTA_LIQUIDITY", initialLiquidity / 10);
        uint128 amount0Max = uint128(vm.envOr("D3VONN_V4_AMOUNT0_MAX", uint256(type(uint128).max)));
        uint128 amount1Max = uint128(vm.envOr("D3VONN_V4_AMOUNT1_MAX", uint256(type(uint128).max)));
        uint128 amount0Min = uint128(vm.envOr("D3VONN_V4_AMOUNT0_MIN", uint256(0)));
        uint128 amount1Min = uint128(vm.envOr("D3VONN_V4_AMOUNT1_MIN", uint256(0)));

        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);
        deal(token0, actor, seedAmount);
        deal(token1, actor, seedAmount);

        vm.startPrank(actor);
        IERC20Minimal(token0).approve(PERMIT2, type(uint256).max);
        IERC20Minimal(token1).approve(PERMIT2, type(uint256).max);
        IPermit2Allowance(PERMIT2).approve(token0, POSITION_MANAGER, type(uint160).max, type(uint48).max);
        IPermit2Allowance(PERMIT2).approve(token1, POSITION_MANAGER, type(uint160).max, type(uint48).max);

        uint256 tokenId = lpm.nextTokenId();
        uint256 gasBefore = gasleft();
        lpm.modifyLiquidities(
            _mintPlan(initialLiquidity, amount0Max, amount1Max, actor),
            block.timestamp + 60
        );
        uint256 mintGas = gasBefore - gasleft();
        assertLt(mintGas, gasCeiling, "mint gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), initialLiquidity, "mint liquidity mismatch");
        emit SimulationMetric("mint", mintGas, 0, initialLiquidity);

        gasBefore = gasleft();
        lpm.modifyLiquidities(
            _increasePlan(tokenId, deltaLiquidity, amount0Max, amount1Max),
            block.timestamp + 60
        );
        uint256 increaseGas = gasBefore - gasleft();
        uint256 afterIncrease = initialLiquidity + deltaLiquidity;
        assertLt(increaseGas, gasCeiling, "increase gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), afterIncrease, "increase mismatch");
        emit SimulationMetric("increase", increaseGas, initialLiquidity, afterIncrease);

        gasBefore = gasleft();
        lpm.modifyLiquidities(
            _decreasePlan(tokenId, deltaLiquidity, amount0Min, amount1Min),
            block.timestamp + 60
        );
        uint256 decreaseGas = gasBefore - gasleft();
        assertLt(decreaseGas, gasCeiling, "decrease gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), initialLiquidity, "decrease mismatch");
        emit SimulationMetric("decrease", decreaseGas, afterIncrease, initialLiquidity);

        gasBefore = gasleft();
        lpm.modifyLiquidities(_collectPlan(tokenId, amount0Min, amount1Min), block.timestamp + 60);
        uint256 collectGas = gasBefore - gasleft();
        assertLt(collectGas, gasCeiling, "collect gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), initialLiquidity, "collect changed liquidity");
        emit SimulationMetric("collect", collectGas, initialLiquidity, initialLiquidity);

        gasBefore = gasleft();
        lpm.modifyLiquidities(
            _decreasePlan(tokenId, initialLiquidity, amount0Min, amount1Min),
            block.timestamp + 60
        );
        uint256 exitGas = gasBefore - gasleft();
        assertLt(exitGas, gasCeiling, "exit gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), 0, "complete exit failed");
        emit SimulationMetric("complete_exit", exitGas, initialLiquidity, 0);
        vm.stopPrank();

        assertGt(IERC20Minimal(token0).balanceOf(actor), 0, "token0 balance lost");
        assertGt(IERC20Minimal(token1).balanceOf(actor), 0, "token1 balance lost");
    }

    function _mintPlan(uint256 liquidity, uint128 amount0Max, uint128 amount1Max, address recipient)
        internal
        view
        returns (bytes memory)
    {
        bytes memory actions = bytes.concat(
            bytes1(uint8(Actions.MINT_POSITION)),
            bytes1(uint8(Actions.CLOSE_CURRENCY)),
            bytes1(uint8(Actions.CLOSE_CURRENCY))
        );
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(key, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, bytes(""));
        params[1] = abi.encode(key.currency0);
        params[2] = abi.encode(key.currency1);
        return abi.encode(actions, params);
    }

    function _increasePlan(uint256 tokenId, uint256 liquidity, uint128 amount0Max, uint128 amount1Max)
        internal
        view
        returns (bytes memory)
    {
        bytes memory actions = bytes.concat(
            bytes1(uint8(Actions.INCREASE_LIQUIDITY)),
            bytes1(uint8(Actions.CLOSE_CURRENCY)),
            bytes1(uint8(Actions.CLOSE_CURRENCY))
        );
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, liquidity, amount0Max, amount1Max, bytes(""));
        params[1] = abi.encode(key.currency0);
        params[2] = abi.encode(key.currency1);
        return abi.encode(actions, params);
    }

    function _decreasePlan(uint256 tokenId, uint256 liquidity, uint128 amount0Min, uint128 amount1Min)
        internal
        view
        returns (bytes memory)
    {
        bytes memory actions = bytes.concat(
            bytes1(uint8(Actions.DECREASE_LIQUIDITY)),
            bytes1(uint8(Actions.CLOSE_CURRENCY)),
            bytes1(uint8(Actions.CLOSE_CURRENCY))
        );
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, liquidity, amount0Min, amount1Min, bytes(""));
        params[1] = abi.encode(key.currency0);
        params[2] = abi.encode(key.currency1);
        return abi.encode(actions, params);
    }

    function _collectPlan(uint256 tokenId, uint128 amount0Min, uint128 amount1Min)
        internal
        view
        returns (bytes memory)
    {
        return _decreasePlan(tokenId, 0, amount0Min, amount1Min);
    }
}
