#!/bin/bash
# WSL execution strategy test runner for CI/CD
# Tests core WSL functionality without requiring actual WSL/Claude installation

echo "🧪 Running WSL Execution Strategy Tests"
echo "========================================"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

echo "🏃 Running core WSL strategy tests..."
npx jest src/utils/__tests__/claudeExecutionStrategy.test.ts src/__tests__/wsl-integration.test.ts --verbose --coverage

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All WSL execution strategy tests passed!"
    echo ""
    echo "📋 Test Coverage Summary:"
    echo "• Core execution strategy functions: ✅"
    echo "• Path translation (Windows to WSL): ✅" 
    echo "• Execution mode validation: ✅"
    echo "• Platform detection: ✅"
    echo "• Error handling and edge cases: ✅"
    echo "• CI/CD compatibility: ✅"
    echo ""
    echo "🎯 Ready for GitHub Actions deployment!"
else
    echo "❌ Some tests failed. Check output above."
    echo ""
    echo "💡 Tips for debugging:"
    echo "• Ensure all mocks are properly configured"
    echo "• Check TypeScript compilation issues"
    echo "• Verify Jest configuration is correct"
fi

exit $TEST_EXIT_CODE