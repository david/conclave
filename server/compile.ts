// Compile entrypoint — used with `bun build --compile` to produce a standalone binary.
// Wires in embedded client assets before starting the server.
//
// Import order matters: embedded-assets resolves first (registering the file imports),
// then index.ts starts the server. The handler is set before any HTTP requests arrive.

import { serveEmbeddedAsset } from "./embedded-assets.ts";
import { setStaticAssetHandler } from "./index.ts";

setStaticAssetHandler(serveEmbeddedAsset);
