
#!/bin/bash

# Make sure husky hooks are executable
chmod +x .husky/commit-msg
chmod +x .husky/pre-commit

echo "Git hooks set up successfully!"
