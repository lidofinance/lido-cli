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
        --balance 100 \
        --chain-id 560048 &

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

    print_status "Impersonating Aragon Agent and granting role..."

    # Impersonate Aragon Agent
    curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"anvil_impersonateAccount\",\"params\":[\"$ADMIN_ACCOUNT\"],\"id\":1}" \
        http://localhost:$ANVIL_PORT >/dev/null

    # Give it ETH
    curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"anvil_setBalance\",\"params\":[\"$ADMIN_ACCOUNT\",\"0x21E19E0C9BAB2400000\"],\"id\":1}" \
        http://localhost:$ANVIL_PORT >/dev/null

    # Grant role using cast
    print_status "Granting submitter role to test account..."
    ETH_FROM=$ADMIN_ACCOUNT cast send $VEBO_CONTRACT "grantRole(bytes32,address)" \
        $SUBMITTER_ROLE $TEST_ACCOUNT \
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
    elif grep -q "RPC request failed\|execution reverted\|Transaction failed\|Failed to submit\|Error:" "$temp_output"; then
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
    print_status "Testing submit-hash with hash calculated from test data..."
    run_test_command "Submit hash calculated from data" \
        "../run.sh vebo submit-hash --calldata 0x000001000000000f00000000000030391234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef --format 1"

    # Test 2: Test submit-data command with the same data used for hash calculation
    print_status "Testing submit-data with matching data..."
    print_status "Note: This test uses the same data that was used to calculate the hash"
    run_test_command "Submit data with matching hash" \
        "../run.sh vebo submit-data --data '$test_data'"

    # Test 3: Test trigger-exit command with the submitted data
    print_status "Testing trigger-exit with the submitted data..."
    print_status "Note: This test uses the same calldata that was submitted in previous tests"
    run_test_command "Trigger exit with submitted data" \
        "../run.sh vebo trigger-exit --calldata 0x000001000000000f00000000000030391234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef --format 1 --value 0.001"

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