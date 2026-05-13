echo "Linting code..."
uv run ty check .
echo "Checking formatting..."
uv run ruff check . --select I --fix