#!/bin/bash

# Rote Backend Initialization Test Runner
# This script runs the initialization tests for the Rote backend

set -e

echo "🚀 Rote Backend Initialization Test Runner"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_URL=${TEST_BASE_URL:-"http://localhost:3000"}
WAIT_TIME=${WAIT_TIME:-5}

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if server is running
check_server() {
    print_status "Checking if server is running at $SERVER_URL..."
    
    if curl -s -f "$SERVER_URL/health" > /dev/null 2>&1; then
        print_success "Server is running and responding"
        return 0
    else
        print_error "Server is not running or not responding at $SERVER_URL"
        print_status "Please start the server first with: npm run dev"
        return 1
    fi
}

# Function to wait for server
wait_for_server() {
    print_status "Waiting for server to be ready..."
    
    for i in {1..30}; do
        if curl -s -f "$SERVER_URL/health" > /dev/null 2>&1; then
            print_success "Server is ready!"
            return 0
        fi
        print_status "Attempt $i/30: Server not ready yet, waiting..."
        sleep 2
    done
    
    print_error "Server did not become ready within 60 seconds"
    return 1
}

# Function to run quick test
run_quick_test() {
    print_status "Running quick initialization test..."
    
    if npm run test:quick; then
        print_success "Quick test completed successfully"
        return 0
    else
        print_error "Quick test failed"
        return 1
    fi
}

# Function to run full test
run_full_test() {
    print_status "Running full initialization test suite..."
    
    if npm run test:init; then
        print_success "Full test suite completed successfully"
        return 0
    else
        print_error "Full test suite failed"
        return 1
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -q, --quick     Run only quick test"
    echo "  -f, --full      Run only full test suite"
    echo "  -a, --all       Run all tests (default)"
    echo "  -w, --wait      Wait for server to be ready"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  TEST_BASE_URL   Base URL for testing (default: http://localhost:3000)"
    echo "  WAIT_TIME       Time to wait for server (default: 5 seconds)"
    echo ""
    echo "Examples:"
    echo "  $0 --quick                    # Run quick test only"
    echo "  $0 --full --wait              # Run full test and wait for server"
    echo "  TEST_BASE_URL=http://localhost:3001 $0  # Test different server"
}

# Main function
main() {
    local run_quick=false
    local run_full=false
    local wait_for_server_flag=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -q|--quick)
                run_quick=true
                shift
                ;;
            -f|--full)
                run_full=true
                shift
                ;;
            -a|--all)
                run_quick=true
                run_full=true
                shift
                ;;
            -w|--wait)
                wait_for_server_flag=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Default to running all tests if no specific test is specified
    if [[ "$run_quick" == false && "$run_full" == false ]]; then
        run_quick=true
        run_full=true
    fi
    
    print_status "Starting Rote Backend Initialization Tests"
    print_status "Server URL: $SERVER_URL"
    print_status "Wait for server: $wait_for_server_flag"
    echo ""
    
    # Check or wait for server
    if [[ "$wait_for_server_flag" == true ]]; then
        if ! wait_for_server; then
            exit 1
        fi
    else
        if ! check_server; then
            exit 1
        fi
    fi
    
    # Run tests
    local exit_code=0
    
    if [[ "$run_quick" == true ]]; then
        if ! run_quick_test; then
            exit_code=1
        fi
        echo ""
    fi
    
    if [[ "$run_full" == true ]]; then
        if ! run_full_test; then
            exit_code=1
        fi
        echo ""
    fi
    
    # Summary
    if [[ $exit_code -eq 0 ]]; then
        print_success "All tests completed successfully! 🎉"
    else
        print_error "Some tests failed. Please check the output above."
    fi
    
    exit $exit_code
}

# Run main function with all arguments
main "$@"
