#!/bin/bash

echo "=========================================="
echo "AIT42 + Worktree + TMUX Integration Test"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Install dependencies
echo -e "${YELLOW}[1/6] Installing dependencies...${NC}"
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi
echo ""

# Test 2: Build TypeScript
echo -e "${YELLOW}[2/6] Building TypeScript...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

# Test 3: Test AIT42 Coordinator
echo -e "${YELLOW}[3/6] Testing AIT42 Coordinator...${NC}"
npm run ait42 "Design and implement a REST API for property management"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ AIT42 Coordinator working${NC}"
else
    echo -e "${RED}✗ AIT42 Coordinator failed${NC}"
    exit 1
fi
echo ""

# Test 4: Test Worktree Manager
echo -e "${YELLOW}[4/6] Testing Worktree Manager...${NC}"
npm run worktree:list
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Worktree Manager working${NC}"
else
    echo -e "${RED}✗ Worktree Manager failed${NC}"
    exit 1
fi
echo ""

# Test 5: Test TMUX Session Manager
echo -e "${YELLOW}[5/6] Testing TMUX Session Manager...${NC}"
npm run tmux:list
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ TMUX Session Manager working${NC}"
else
    echo -e "${RED}✗ TMUX Session Manager failed${NC}"
    exit 1
fi
echo ""

# Test 6: Full integration test
echo -e "${YELLOW}[6/6] Running full integration test...${NC}"
npm run dev status
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Integration test passed${NC}"
else
    echo -e "${RED}✗ Integration test failed${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo -e "${GREEN}All tests passed successfully!${NC}"
echo "=========================================="
echo ""
echo "Ready to use. Try these commands:"
echo "  npm run dev execute \"Your task description\""
echo "  npm run dev status"
echo ""
