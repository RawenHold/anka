# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, with a static build suitable for ordinary web hosting.

## Users

Russian-speaking viewers who already follow Anya and Sergey, and people meeting them for the first time. They come to learn who the couple are, find a particular video or moment, see places mentioned in their videos, and follow their public channels.

## Product Purpose

This is Anya and Sergey’s personal website. It brings their story, video archive, travel map, music, truck, and social links together in one warm place. Visitors should be able to move naturally from learning about the couple to the video or public channel they came for.

## Positioning

The site is told in the couple’s own first-person plural voice and follows their life between the road and home. Its archive and map are based on published videos; it is not a live fleet tracker or a GPS route log.

## Operating Context

Visitors browse a single-page site, search videos by subject, title, chapter, or place, open videos on YouTube, and follow links to public social profiles. On 17 November 2026 the channel's public uploads playlist contained 232 unique videos. The site also has 24 approximate place markers and music extracted from 230 available descriptions; the catalogue is a dated snapshot and does not include private or deleted videos.

## Capabilities and Constraints

- Preserve source-backed photo, video, music, biography, and social material; the latest captured channel metadata is in `src/data/channel-catalog.json` and editorial enrichment is in `js/data.js`.
- Map locations are approximate editorial markers derived from video references, not precise routes or continuous tracking.
- Video embeds and social links depend on their external platforms. Map tiles need an internet connection and visible attribution.
- Preserve keyboard access, clear focus states, responsive layouts, and reduced-motion support.

## Brand Commitments

Use the name ANKA and a warm, unhurried, personal tone. Write site-authored interface copy as “мы” and “у нас”; keep original video titles intact. Do not invent quotations or private facts about the couple.

## Evidence on Hand

Project materials include `js/data.js`, `src/data/`, `images/`, `sources/`, and `data/us-states.geojson`. YouTube titles and dates were collected from the public uploads playlist; some categories and place links are preliminary text matches. New frame sources are in `public/images/research/SOURCES.md`.

## Product Principles

- Let visitors find the people and the content without guessing where to click.
- Keep the difference between a video-derived place and a verified route clear.
- Make the site feel like an invitation into the couple’s world, not a generic channel directory.
