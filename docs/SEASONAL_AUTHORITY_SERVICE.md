# Seasonal authority service

This service is a persistent Node.js authority for room seasonal progress. It stores room state in a private JSON file, issues per-member bearer tokens, validates each event with the same reducer used by the browser game, and restores snapshots when the process starts again.

## Run

Use Node.js 20 or newer. From the project directory:

```sh
npm run start:authority
```

Set `PORT`, `GH_AUTHORITY_DATA`, and `GH_AUTHORITY_ORIGIN` for deployment. `GH_AUTHORITY_ORIGIN` should be the exact game origin when exposed to browsers. The default data file is `data/rooms.json`; it is intentionally ignored by Git because it contains live room records and token hashes.

For a container host, deploy with `docker compose -f docker-compose.authority.yml up -d --build`. The named volume keeps room snapshots across container replacement.

## API

`GET /health` returns service health and room count.

`POST /v1/rooms` accepts `{ "roomId", "theme", "name" }` and creates a room. Themes are `christmas`, `halloween`, `valentine`, and `tet`. The response includes a one-time bearer token for the creator.

`POST /v1/rooms/:roomId/join` accepts `{ "name" }` and returns a member token and the current snapshot.

`GET /v1/rooms/:roomId/state` returns the current seasonal snapshot. `GET /v1/rooms/:roomId/events?after=<sequence>` returns later event markers. Both require `Authorization: Bearer <token>`.

`POST /v1/rooms/:roomId/events` accepts `{ "operation": { "k": "seasonal_event", ... } }`. The service validates the operation, rejects duplicate collection and unsupported race results, increments a monotonically increasing sequence, persists the state before replying, and returns the canonical snapshot. Payloads are limited to 16 KiB.

## Connect the browser game

Deploy this service separately from GitHub Pages, then open the game with `?authority=https%3A%2F%2Fyour-authority.example`. With this parameter set, the game creates or joins the matching authority room, stores its bearer token for reconnect, polls canonical snapshots, and sends seasonal operations to the service. If the service is unavailable, seasonal progress is locked instead of silently falling back to client-side writes. Without the parameter, the game keeps its existing P2P room transport.

## Current limits

The sled race stores a server-generated gate sequence, validates each lane choice against server time, accounts for missed gates and calculates the finish record on the service. Valentine dance runs also use server-generated sequences and server-timed input windows for rhythm, memory and copy modes; score records are calculated by the authority and client-submitted `dance_record` scores are rejected. A late join receives persisted room progress, while private race and dance inputs are only included in the matching member's snapshot. Position-bound validation for collectible pickups still requires movement telemetry to be sent through the authority. The P2P transport remains responsible for movement, chat, voice and the rest of the real-time scene. The JSON store suits a single service instance and should be replaced with a transactional database before horizontal scaling.
