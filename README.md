# parseaple

A collection of TypeScript libraries for parsing Apple's binary formats.

## Packages

| Package | Description |
|---|---|
| [@parseaple/typedstream](./packages/typedstream) | Parser for Apple's typedstream/NSArchiver binary format |
| [@parseaple/bplist](./packages/bplist) | Binary plist parser for Node.js |

## Development

This is a [Bun](https://bun.sh) monorepo.

```
bun install
```

### Build all packages

```
bun run build
```

### Test all packages

```
bun run test
```

## License

MIT