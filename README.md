# Glitsy Serum 2 Preset Editor

A local-first web application for unpacking, editing, and re-packing Xfer Serum 2 `.SerumPreset` files using natural-language instructions that are translated into RFC 6902 JSON Patches.

## Features

- Upload a Serum 2 preset file, unpack it to readable JSON, and inspect metadata.
- Edit values via a rich JSON editor with linting-friendly formatting.
- Describe desired changes in natural language and preview the generated JSON Patch and diff.
- Safely validate and apply patches before re-packing the preset.
- Download the updated preset as a valid `.SerumPreset`.

## Getting started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) 8+

You can use npm or yarn instead of pnpm. Equivalent commands are provided below.

### Installation

```bash
pnpm install
```

Using npm instead:

```bash
npm install
```

### Environment variables

Copy `.env.example` to `.env` and fill in values as needed.

```bash
cp .env.example .env
```

Set `OPENAI_API_KEY` to enable automatic JSON Patch proposals. Without it, the app will still run but the Modify API will return an empty patch with a message explaining that LLM support is disabled.

If the `node-serum2-preset-packager` dependency triggers a post-install step for Zstandard binaries, follow the prompts. On Linux you may need `build-essential` and `python3` for native compilation.

### Running the development servers

Start the API server:

```bash
pnpm dev:server
```

In another terminal, start the Vite dev server:

```bash
pnpm dev:client
```

If you prefer npm, replace `pnpm` with `npm run` (e.g. `npm run dev:server`).

The frontend is available at [http://localhost:5173](http://localhost:5173) and proxies API requests to `http://localhost:4000`.

### Testing

```bash
pnpm test
```

### Building for production

```bash
pnpm build
```

This builds the frontend bundle in `dist/`. Deploy the `server/index.ts` entry point with Node.js and configure it to serve files from `dist/` or another static host of your choice.

## API summary

| Method | Endpoint       | Description |
| ------ | -------------- | ----------- |
| POST   | `/api/unpack`  | Upload a `.SerumPreset`, unpack to JSON, and return metadata + payload. |
| POST   | `/api/modify`  | Generate a JSON Patch from a natural-language instruction, validate, apply, and return the diff. |
| POST   | `/api/pack`    | Pack edited JSON back into a `.SerumPreset` binary for download. |

See inline comments in the server files for more details about error handling and response shapes.

## License

MIT
