#!/bin/bash

# Test script for new TW (exit-bus-oracle) commands
# This script forks Anvil from Hoodi testnet and tests the new commands

set -e  # Exit on any error

# Configuration
HOODI_RPC_URL="https://ethereum-hoodi-rpc.publicnode.com"
ANVIL_PORT=8545
ANVIL_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

print_success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Function to cleanup on script exit
cleanup() {
    print_status "Cleaning up..."

    if [ ! -z "$ANVIL_PID" ] && kill -0 $ANVIL_PID 2>/dev/null; then
        print_status "Stopping Anvil (PID: $ANVIL_PID)..."
        kill $ANVIL_PID
        wait $ANVIL_PID 2>/dev/null || true
        print_success "Anvil stopped"
    fi

    # Clean up any remaining anvil processes on the port
    local anvil_processes=$(lsof -ti:$ANVIL_PORT 2>/dev/null || true)
    if [ ! -z "$anvil_processes" ]; then
        print_status "Killing remaining processes on port $ANVIL_PORT..."
        echo $anvil_processes | xargs kill -9 2>/dev/null || true
    fi


    print_status "Cleanup completed"
}

# Set up trap to ensure cleanup runs on script exit
trap cleanup EXIT INT TERM

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for anvil to be ready
wait_for_anvil() {
    local max_attempts=30
    local attempt=1

    print_status "Waiting for Anvil to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s -X POST \
            -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
            http://localhost:$ANVIL_PORT >/dev/null 2>&1; then
            print_success "Anvil is ready on port $ANVIL_PORT"
            return 0
        fi

        print_status "Attempt $attempt/$max_attempts - waiting for Anvil..."
        sleep 2
        attempt=$((attempt + 1))
    done

    print_error "Anvil failed to start within expected time"
    return 1
}

# Function to start Anvil fork
start_anvil() {
    print_status "Starting Anvil fork from Hoodi testnet..."
    print_status "RPC URL: $HOODI_RPC_URL"
    print_status "Local port: $ANVIL_PORT"

    # Check if anvil is available
    if ! command_exists anvil; then
        print_error "Anvil not found. Please install Foundry: https://getfoundry.sh/"
        exit 1
    fi

    # Check if port is already in use
    if lsof -ti:$ANVIL_PORT >/dev/null 2>&1; then
        print_error "Port $ANVIL_PORT is already in use"
        exit 1
    fi

    # Start anvil in background with output to console
    print_status "Anvil output will be shown below:"
    echo ""
    anvil \
        --fork-url "$HOODI_RPC_URL" \
        --port $ANVIL_PORT \
        --host 0.0.0.0 \
        --accounts 10 \
        --balance 100000 \
        --chain-id 560048 \
        --base-fee 0 \
        --gas-price 1 \
        --gas-limit 30000000 &

    ANVIL_PID=$!

    if ! kill -0 $ANVIL_PID 2>/dev/null; then
        print_error "Failed to start Anvil"
        exit 1
    fi

    print_status "Anvil started with PID: $ANVIL_PID"

    # Wait for Anvil to be ready
    wait_for_anvil
}

# Function to setup test permissions using cast
setup_test_permissions() {
    print_status "Setting up test permissions with cast..."

    local VEBO_CONTRACT="0x8664d394C2B3278F26A1B44B967aEf99707eeAB2"
    local TEST_ACCOUNT="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    local ADMIN_ACCOUNT="0x0534aA41907c9631fae990960bCC72d75fA7cfeD"
    local SUBMITTER_ROLE="0x22ebb4dbafb72948800c1e1afa1688772a1a4cfc54d5ebfcec8163b1139c082e"
    local EXIT_REQUEST_LIMIT_MANAGER_ROLE="0x9c616dd118785b2e2fccf45a4ff151a335ff7b6a84cd1c4d7fd9f97f39ea9342"
    local TWG_CONTRACT="0x6679090D92b08a2a686eF8614feECD8cDFE209db"
    local TW_EXIT_LIMIT_MANAGER_ROLE="0x03c30da9b9e4d4789ac88a294d39a63058ca4a498804c2aa823e381df59d0cf4"
    local NOR_CONTRACT="0x5cDbE1590c083b5A2A64427fAA63A7cfDB91FbB5"
    local MANAGE_NODE_OPERATOR_ROLE="0x78523850fdd761612f46e844cf5a16bda6b3151d6ae961fd7e8e7b92bfbca7f8"

    print_status "Impersonating Aragon Agent and granting role..."

    # Impersonate Aragon Agent
    curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"anvil_impersonateAccount\",\"params\":[\"$ADMIN_ACCOUNT\"],\"id\":1}" \
        http://localhost:$ANVIL_PORT >/dev/null

    # Give ETH to admin account (100 ETH)
    curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"anvil_setBalance\",\"params\":[\"$ADMIN_ACCOUNT\",\"0x56BC75E2D630E0000\"],\"id\":1}" \
        http://localhost:$ANVIL_PORT >/dev/null

    # Give ETH to test account (1000000 ETH to ensure enough for all tests even with high gas)
    curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"anvil_setBalance\",\"params\":[\"$TEST_ACCOUNT\",\"0xD3C21BCECCEDA1000000\"],\"id\":1}" \
        http://localhost:$ANVIL_PORT >/dev/null

    # Grant submitter role using cast
    print_status "Granting submitter role to test account..."
    ETH_FROM=$ADMIN_ACCOUNT cast send $VEBO_CONTRACT "grantRole(bytes32,address)" \
        $SUBMITTER_ROLE $TEST_ACCOUNT \
        --rpc-url http://localhost:$ANVIL_PORT \
        --unlocked \
        --gas-limit 200000 >/dev/null 2>&1

    # Grant limit manager role using cast
    print_status "Granting exit request limit manager role to test account..."
    ETH_FROM=$ADMIN_ACCOUNT cast send $VEBO_CONTRACT "grantRole(bytes32,address)" \
        $EXIT_REQUEST_LIMIT_MANAGER_ROLE $TEST_ACCOUNT \
        --rpc-url http://localhost:$ANVIL_PORT \
        --unlocked \
        --gas-limit 200000 >/dev/null 2>&1

    # Grant TWG limit manager role using cast
    print_status "Granting TWG exit request limit manager role to test account..."
    ETH_FROM=$ADMIN_ACCOUNT cast send $TWG_CONTRACT "grantRole(bytes32,address)" \
        $TW_EXIT_LIMIT_MANAGER_ROLE $TEST_ACCOUNT \
        --rpc-url http://localhost:$ANVIL_PORT \
        --unlocked \
        --gas-limit 200000 >/dev/null 2>&1

    print_success "Test permissions setup completed"
    sleep 1
}

# Function to run a test command and log results
run_test_command() {
    local test_name="$1"
    local command="$2"

    print_status "Running test: $test_name"
    print_status "Command: $command"
    echo ""

    # Set environment variables for local testing
    export RPC_URL="http://localhost:$ANVIL_PORT"
    export NETWORK="hoodi"
    export CHAIN_ID="560048"
    export EL_CHAIN_ID="560048"
    export EL_NETWORK_NAME="hoodi"
    export EL_API_PROVIDER="http://localhost:$ANVIL_PORT"

    # Refill balance before each test to avoid gas issues
    curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"anvil_setBalance\",\"params\":[\"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\",\"0x152D02C7E14AF6800000\"],\"id\":1}" \
        http://localhost:$ANVIL_PORT >/dev/null

    # Run command with output to both console and file
    echo "--- Command output ---"

    # Capture output to a temp file for analysis
    local temp_output=$(mktemp)
    local exit_code=0

    eval "$command" 2>&1 | tee "$temp_output"
    exit_code=${PIPESTATUS[0]}

    # Check for RPC errors, transaction failures, or other error indicators
    local has_errors=false
    if [ $exit_code -ne 0 ]; then
        has_errors=true
    elif grep -q "RPC request failed\|execution reverted\|Transaction failed\|Failed to submit\|Error:\|Insufficient funds\|insufficient funds" "$temp_output"; then
        has_errors=true
    fi

    # Clean up temp file
    rm -f "$temp_output"

    echo ""
    if [ "$has_errors" = false ]; then
        print_success "Test '$test_name' passed"
    else
        print_error "Test '$test_name' failed"
    fi

    echo "======================"
    echo ""
}

# Function to run a test command with admin account (for Aragon Apps like NOR)
run_test_command_with_admin() {
    local test_name="$1"
    local command="$2"
    local admin_account="0x0534aA41907c9631fae990960bCC72d75fA7cfeD"

    print_status "Running test: $test_name"
    print_status "Command: $command (using admin account)"
    echo ""

    # Set environment variables for local testing with admin account
    export RPC_URL="http://localhost:$ANVIL_PORT"
    export NETWORK="hoodi"
    export CHAIN_ID="560048"
    export EL_CHAIN_ID="560048"
    export EL_NETWORK_NAME="hoodi"
    export EL_API_PROVIDER="http://localhost:$ANVIL_PORT"
    export WALLET_ADDRESS="$admin_account"
    export WALLET_PRIVATE_KEY=""
    export ANVIL_IMPERSONATE="true"

    # Refill balance for admin account
    curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"anvil_setBalance\",\"params\":[\"$admin_account\",\"0x152D02C7E14AF6800000\"],\"id\":1}" \
        http://localhost:$ANVIL_PORT >/dev/null

    # Run command with output to console
    echo "--- Command output ---"
    local temp_output=$(mktemp)
    eval "$command" 2>&1 | tee "$temp_output"
    exit_code=${PIPESTATUS[0]}

    # Check for RPC errors, transaction failures, or other error indicators
    local has_errors=false
    if [ $exit_code -ne 0 ]; then
        has_errors=true
    elif grep -q "RPC request failed\|execution reverted\|Transaction failed\|Failed to submit\|Error:\|Insufficient funds\|insufficient funds" "$temp_output"; then
        has_errors=true
    fi

    # Clean up temp file
    rm -f "$temp_output"

    echo ""
    if [ "$has_errors" = false ]; then
        print_success "Test '$test_name' passed"
    else
        print_error "Test '$test_name' failed"
    fi

    echo "======================"
    echo ""
}


# Function to run all tests
run_tests() {
    print_status "Starting test suite for new TW commands..."
    print_status "Testing new exit-bus-oracle commands added in this branch..."

    # Define test data for both tests to ensure hash matches data
    local test_data='1,15,12345,0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

    # Test 1: Test submit-hash command with calculated hash from test data
    run_test_command "Submit hash calculated from data" \
        "../run.sh vebo submit-hash --calldata 0x000001000000000f00000000000030391234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef --format 1"

    # Test 2: Test submit-data command with the same data used for hash calculation
    run_test_command "Submit data with matching hash" \
        "../run.sh vebo submit-data --data '$test_data'"

    # Test 3: Test trigger-exit command with the submitted data
    run_test_command "Trigger exit with submitted data" \
        "../run.sh vebo trigger-exit --calldata 0x000001000000000f00000000000030391234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef --format 1 --value 0.001"

    # Test 4: Test set-limits command with valid parameters
    run_test_command "Set exit request limits" \
        "../run.sh vebo set-limits --max-exit-requests-limit 11200 --exits-per-frame 1 --frame-duration 48"

    # Test 5: Test TWG set-limits command with valid parameters
    run_test_command "Set TWG exit request limits" \
        "../run.sh twg set-limits --max-exit-requests-limit 11200 --exits-per-frame 1 --frame-duration 48"

    # Test 6: Test VEB get-limits command (read-only, no admin privileges required)
    run_test_command "Get VEB exit request limits" \
        "../run.sh vebo get-limits"

    # Test 7: Test TWG get-limits command (read-only, no admin privileges required)
    run_test_command "Get TWG exit request limits" \
        "../run.sh twg get-limits"

    # Test 8: Test NOR get-deadline command (read-only, no admin privileges required)
    run_test_command "Get NOR exit deadline threshold" \
        "../run.sh nor get-deadline --node-operator-id 0"

    print_status "Test suite completed"
}

# Function to display test results summary
show_test_summary() {
    print_status "Test Results Summary:"
    echo ""

    # Count tests by looking at console output stored in a temporary way
    # Since we removed file logging, we'll use a simpler approach
    print_success "All tests completed - check console output above for individual results"
}


# Main execution
print_status "TW Commands Test Suite"
print_status "====================="
echo ""


# Start the test sequence
start_anvil
sleep 5  # Give Anvil more time to fully initialize and show startup logs

setup_test_permissions

run_tests

show_test_summary

print_status "Test suite execution completed"