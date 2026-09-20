# HNF.TV Streaming Runbook

## Goal

Deploy a five-channel HNF.TV linear streaming stack on a dedicated Linux host.

Channels:

- Pee Wee & Friends: `/peewee`
- HNF Academy: `/academy`
- HNF.TV: `/hnftv`
- Hip Hop National Flag: `/hiphop`
- HNF Chef TV: `/chef`

Public HLS pattern:

`https://stream.hnfportal.one/<channel>/index.m3u8`

## Stack

- Tunarr for channel scheduling and playout from owned/licensed media
- MediaMTX for RTMP ingest and HLS/LL-HLS delivery
- Caddy for HTTPS and `stream.hnfportal.one`
- Docker Compose for service lifecycle

Tunarr includes FFmpeg in its Docker image. MediaMTX is pinned to the stable 1.x line.

## DigitalOcean host

Recommended initial size: 2 vCPU / 4 GB RAM for light software transcoding and early audience traffic.

Before provisioning:

1. Clear the DigitalOcean team Droplet quota.
2. Create the host.
3. Point `stream.hnfportal.one` to the host public IPv4 address.
4. Allow TCP 80, 443, and 1935 only if live RTMP ingest is required externally.
5. Keep Tunarr admin bound to localhost and manage it through SSH tunneling.

## Bring-up

From `infra/hnftv`:

```bash
mkdir -p media tunarr-data recordings
docker compose pull
docker compose up -d
docker compose ps
```

Tunarr admin is available only from the host at `127.0.0.1:8000`.

Use an SSH tunnel for remote administration:

```bash
ssh -L 8000:127.0.0.1:8000 <user>@<host>
```

Then open `http://127.0.0.1:8000`.

## Publishing into MediaMTX

Each channel accepts a publisher on the matching RTMP path:

- `rtmp://127.0.0.1:1935/peewee`
- `rtmp://127.0.0.1:1935/academy`
- `rtmp://127.0.0.1:1935/hnftv`
- `rtmp://127.0.0.1:1935/hiphop`
- `rtmp://127.0.0.1:1935/chef`

An FFmpeg bridge can pull a Tunarr channel stream and publish it to MediaMTX. The exact Tunarr channel URL is created after the channel is configured in Tunarr.

Example:

```bash
ffmpeg -re -i "$SOURCE_URL" \
  -c:v libx264 -preset veryfast -g 60 \
  -c:a aac -b:a 128k \
  -f flv "rtmp://127.0.0.1:1935/chef"
```

For production, run one supervised bridge per channel using systemd or a container restart policy.

## Chef channel programming

Suggested blocks:

- Breakfast & Brunch
- Soul Food
- Healthy Cooking
- International Kitchen
- Baking & Desserts
- BBQ & Grill
- Budget Meals
- Kids Cook
- Chef Interviews
- Live Kitchen

Only schedule content HNF owns, licenses, or has verified rights to rebroadcast.

## Health checks

A channel is considered live when its playlist returns HTTP 200:

```bash
curl -fsS https://stream.hnfportal.one/chef/index.m3u8 >/dev/null
```

Monitor all five paths independently so one failed channel does not mark the whole HNF.TV platform down.
