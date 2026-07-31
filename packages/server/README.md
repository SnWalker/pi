# @earendil-works/pi-server

Experimental. This package is under active development and may change or be removed without notice. Its APIs and behavior are not yet stable.

Transport-neutral session server for pi.

## Session server core

The package exports the `PiServer` session server and listener composition APIs.

```ts
import type { PiSessionBackend } from "@earendil-works/pi-server";
import { createUnixServer } from "@earendil-works/pi-server/unix";

const backend: PiSessionBackend = {
  async listSessions() {
    return storage.listSessions();
  },
  async listModels() {
    return modelRegistry.listModels();
  },
  async createSession(options) {
    return storage.createAndOpen(options);
  },
  async openSession(sessionId) {
    return storage.open(sessionId);
  },
};

const server = createUnixServer(backend, {
  token: process.env.PI_SERVER_TOKEN!,
  path: "/tmp/pi/server.sock",
});
await server.start();
```

`PiServer` composes transport listeners through the `PiServerListener` interface. The Unix submodule exports the `createUnixListener()` building block and `createUnixServer()` preset, keeping the common case concise without coupling the primary server to Unix sockets. The listener uses authenticated, length-prefixed CBOR messages from `@earendil-works/pi-protocol`.

## Transport testing

Custom transports can use `@earendil-works/pi-server/testing` for deterministic protocol conformance tests. It exports `createTestServer()`, `TestSessionBackend`, `ProtocolTestClient`, and the transport-neutral `WireChannel` contract. `connectUnixTestClient()` is provided for Unix transport tests.

## `pi-ai` protocol bridge

`@earendil-works/pi-ai` domain objects and `@earendil-works/pi-protocol` wire DTOs remain independent. This package owns their boundary and exports `toProtocolModelMetadata()`, `toProtocolAssistantMessage()`, `toProtocolUserMessage()`, and `toProtocolToolResultMessage()`.

The adapters reject invalid tool inputs, explicitly sanitize diagnostic details, and exhaustively handle closed `pi-ai` unions. The protocol mirrors `pi-ai` vocabulary such as `toolCall` and `toolUse` where the semantics are identical. Compile-time assertions cover shared thinking-level and model-input vocabularies. Tests encode adapter output through the protocol runtime schemas so incompatible changes fail in the bridging package.
