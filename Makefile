.PHONY: dev build test lint ext

dev:
	pnpm turbo dev

build:
	pnpm turbo build

test:
	pnpm turbo test

lint:
	pnpm turbo lint

ext:
	pnpm --filter @bingeroom/extension build
