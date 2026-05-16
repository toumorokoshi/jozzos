format:
    npx prettier --write .

lint:
    npx eslint .

fix:
    npx prettier --write .
    npx eslint . --fix
