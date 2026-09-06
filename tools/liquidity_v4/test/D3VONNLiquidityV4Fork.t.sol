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

contract D3VONNLiquidityV4ForkTest is Test {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    address internal constant POOL_MANAGER = 0x498581ff718922c3f8e6a244956af099b2652b2b;
    address internal constant POSITION_MANAGER = 0x7c5f5a4bbd8fd63184577525326123b519429bdc;
    address internal constant STATE_VIEW = 0xa3c0c9b65bad0b08107aa264b0f3db444b867a71;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    struct LifecycleConfig {
        uint256 seedAmount;
        uint256 initialLiquidity;
        uint256 deltaLiquidity;
        uint128 amount0Max;
        uint128 amount1Max;
        uint128 amount0Min;
        uint128 amount1Min;
    }

    struct GasMetrics {
        uint256 mintGas;
        uint256 increaseGas;
        uint256 decreaseGas;
        uint256 collectGas;
        uint256 exitGas;
    }

    IPositionManager internal lpm = IPositionManager(POSITION_MANAGER);
    IStateView internal stateView = IStateView(STATE_VIEW);

    PoolKey internal key;
    PoolId internal expectedPoolId;
    address internal actor;
    int24 internal tickLower;
    int24 internal tickUpper;
    uint256 internal gasCeiling;
    uint256 internal proposalDeadline;

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
        proposalDeadline = vm.envUint("D3VONN_V4_PROPOSAL_DEADLINE");

        key = PoolKey({currency0: currency0, currency1: currency1, fee: fee, tickSpacing: tickSpacing, hooks: hooks});

        assertEq(PoolId.unwrap(key.toId()), PoolId.unwrap(expectedPoolId), "PoolKey/PoolId mismatch");
        assertEq(address(stateView.poolManager()), POOL_MANAGER, "StateView manager mismatch");
        assertEq(address(lpm.poolManager()), POOL_MANAGER, "PositionManager manager mismatch");

        (uint160 sqrtPriceX96, int24 currentTick,,) = stateView.getSlot0(expectedPoolId);
        assertGt(uint256(sqrtPriceX96), 0, "pool not initialized");
        assertLe(tickLower, currentTick, "current tick below range");
        assertLt(currentTick, tickUpper, "current tick above range");
        assertGt(proposalDeadline, block.timestamp, "proposal deadline not valid on fork");

        assertTrue(Currency.unwrap(currency0) != address(0), "native currency mutation disabled");
        assertTrue(Currency.unwrap(currency1) != address(0), "native currency mutation disabled");
        assertLt(Currency.unwrap(currency0), Currency.unwrap(currency1), "pool currencies must be sorted");

        actor = vm.envAddress("D3VONN_V4_SAFE_ADDRESS");
        assertTrue(actor != address(0), "safe address required");
    }

    function test_readOnlyCanonicalState() public view {
        (uint160 sqrtPriceX96,,, uint24 lpFee) = stateView.getSlot0(expectedPoolId);
        stateView.getLiquidity(expectedPoolId);
        require(sqrtPriceX96 > 0, "zero sqrt price");
        require(lpFee <= type(uint24).max, "invalid lp fee");
    }

    function test_forkOnlyPositionLifecycle() public {
        if (!vm.envOr("D3VONN_V4_MUTATION_TESTS", false)) return;

        LifecycleConfig memory cfg = LifecycleConfig({
            seedAmount: vm.envOr("D3VONN_V4_SEED_AMOUNT", uint256(1e24)),
            initialLiquidity: vm.envOr("D3VONN_V4_INITIAL_LIQUIDITY", uint256(1e12)),
            deltaLiquidity: vm.envOr("D3VONN_V4_DELTA_LIQUIDITY", uint256(1e11)),
            amount0Max: uint128(vm.envOr("D3VONN_V4_AMOUNT0_MAX", uint256(type(uint128).max))),
            amount1Max: uint128(vm.envOr("D3VONN_V4_AMOUNT1_MAX", uint256(type(uint128).max))),
            amount0Min: uint128(vm.envOr("D3VONN_V4_AMOUNT0_MIN", uint256(0))),
            amount1Min: uint128(vm.envOr("D3VONN_V4_AMOUNT1_MIN", uint256(0)))
        });
        require(cfg.initialLiquidity > 0, "initial liquidity must be positive");
        require(cfg.deltaLiquidity > 0, "delta liquidity must be positive");

        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);
        deal(token0, actor, cfg.seedAmount);
        deal(token1, actor, cfg.seedAmount);

        vm.startPrank(actor);
        IERC20Minimal(token0).approve(PERMIT2, type(uint256).max);
        IERC20Minimal(token1).approve(PERMIT2, type(uint256).max);
        IPermit2Allowance(PERMIT2).approve(token0, POSITION_MANAGER, type(uint160).max, type(uint48).max);
        IPermit2Allowance(PERMIT2).approve(token1, POSITION_MANAGER, type(uint160).max, type(uint48).max);

        uint256 tokenId = lpm.nextTokenId();
        bytes memory mintPlan = _mintPlan(cfg.initialLiquidity, cfg.amount0Max, cfg.amount1Max, actor);
        bytes memory candidateCalldata = abi.encodeCall(IPositionManager.modifyLiquidities, (mintPlan, proposalDeadline));
        GasMetrics memory metrics;

        uint256 gasBefore = gasleft();
        lpm.modifyLiquidities(mintPlan, proposalDeadline);
        metrics.mintGas = gasBefore - gasleft();
        assertLt(metrics.mintGas, gasCeiling, "mint gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), cfg.initialLiquidity, "mint liquidity mismatch");
        emit SimulationMetric("mint", metrics.mintGas, 0, cfg.initialLiquidity);

        gasBefore = gasleft();
        lpm.modifyLiquidities(_increasePlan(tokenId, cfg.deltaLiquidity, cfg.amount0Max, cfg.amount1Max), proposalDeadline);
        metrics.increaseGas = gasBefore - gasleft();
        uint256 afterIncrease = cfg.initialLiquidity + cfg.deltaLiquidity;
        assertLt(metrics.increaseGas, gasCeiling, "increase gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), afterIncrease, "increase mismatch");
        emit SimulationMetric("increase", metrics.increaseGas, cfg.initialLiquidity, afterIncrease);

        gasBefore = gasleft();
        lpm.modifyLiquidities(_decreasePlan(tokenId, cfg.deltaLiquidity, cfg.amount0Min, cfg.amount1Min), proposalDeadline);
        metrics.decreaseGas = gasBefore - gasleft();
        assertLt(metrics.decreaseGas, gasCeiling, "decrease gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), cfg.initialLiquidity, "decrease mismatch");
        emit SimulationMetric("decrease", metrics.decreaseGas, afterIncrease, cfg.initialLiquidity);

        gasBefore = gasleft();
        lpm.modifyLiquidities(_collectPlan(tokenId, cfg.amount0Min, cfg.amount1Min), proposalDeadline);
        metrics.collectGas = gasBefore - gasleft();
        assertLt(metrics.collectGas, gasCeiling, "collect gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), cfg.initialLiquidity, "collect changed liquidity");
        emit SimulationMetric("collect", metrics.collectGas, cfg.initialLiquidity, cfg.initialLiquidity);

        gasBefore = gasleft();
        lpm.modifyLiquidities(_decreasePlan(tokenId, cfg.initialLiquidity, cfg.amount0Min, cfg.amount1Min), proposalDeadline);
        metrics.exitGas = gasBefore - gasleft();
        assertLt(metrics.exitGas, gasCeiling, "exit gas ceiling exceeded");
        assertEq(uint256(lpm.getPositionLiquidity(tokenId)), 0, "complete exit failed");
        emit SimulationMetric("complete_exit", metrics.exitGas, cfg.initialLiquidity, 0);
        vm.stopPrank();

        assertGt(IERC20Minimal(token0).balanceOf(actor), 0, "token0 balance lost");
        assertGt(IERC20Minimal(token1).balanceOf(actor), 0, "token1 balance lost");

        _writePassingReport(cfg, metrics, candidateCalldata);
    }

    function _writePassingReport(LifecycleConfig memory cfg, GasMetrics memory metrics, bytes memory candidateData)
        internal
    {
        vm.createDir("./reports", true);
        string memory objectKey = "d3vonn_v4_simulation";
        vm.serializeString(objectKey, "schema_version", "d3vonn.liquidity.v4.simulation-report.v1");
        vm.serializeString(objectKey, "status", "pass");
        vm.serializeUint(objectKey, "chain_id", block.chainid);
        vm.serializeUint(objectKey, "fork_block_number", block.number);
        vm.serializeString(objectKey, "pool_id", vm.toString(PoolId.unwrap(expectedPoolId)));
        vm.serializeAddress(objectKey, "currency0", Currency.unwrap(key.currency0));
        vm.serializeAddress(objectKey, "currency1", Currency.unwrap(key.currency1));
        vm.serializeUint(objectKey, "fee", key.fee);
        vm.serializeInt(objectKey, "tick_spacing", key.tickSpacing);
        vm.serializeAddress(objectKey, "hooks", address(key.hooks));
        vm.serializeInt(objectKey, "tick_lower", tickLower);
        vm.serializeInt(objectKey, "tick_upper", tickUpper);
        vm.serializeAddress(objectKey, "safe_address", actor);
        vm.serializeUint(objectKey, "proposal_deadline", proposalDeadline);
        vm.serializeUint(objectKey, "gas_ceiling", gasCeiling);
        vm.serializeUint(objectKey, "initial_liquidity", cfg.initialLiquidity);
        vm.serializeUint(objectKey, "delta_liquidity", cfg.deltaLiquidity);
        vm.serializeUint(objectKey, "amount0_max", cfg.amount0Max);
        vm.serializeUint(objectKey, "amount1_max", cfg.amount1Max);
        vm.serializeUint(objectKey, "amount0_min", cfg.amount0Min);
        vm.serializeUint(objectKey, "amount1_min", cfg.amount1Min);
        vm.serializeUint(objectKey, "mint_gas", metrics.mintGas);
        vm.serializeUint(objectKey, "increase_gas", metrics.increaseGas);
        vm.serializeUint(objectKey, "decrease_gas", metrics.decreaseGas);
        vm.serializeUint(objectKey, "collect_gas", metrics.collectGas);
        vm.serializeUint(objectKey, "exit_gas", metrics.exitGas);
        vm.serializeUint(objectKey, "final_position_liquidity", 0);
        vm.serializeAddress(objectKey, "candidate_to", POSITION_MANAGER);
        vm.serializeUint(objectKey, "candidate_value", 0);
        vm.serializeBytes(objectKey, "candidate_data", candidateData);
        vm.serializeBool(objectKey, "private_key_access", false);
        vm.serializeBool(objectKey, "signing_enabled", false);
        vm.serializeBool(objectKey, "broadcast_enabled", false);
        string memory json = vm.serializeBool(objectKey, "production_execution_enabled", false);
        vm.writeJson(json, "./reports/raw-simulation-report.json");
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
