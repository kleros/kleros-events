# Fonts for the share image

`app/events/[slug]/opengraph-image.tsx` draws the share image (`../share.ts`) with these TTF files (satori reads TTF or OTF only).
The width tables in `../widths.ts` and `../widths-geist.ts` were measured from these exact files, so replace them
together.

- Instrument Serif Regular, by Rodrigo Fuenzalida and Jordan Egstad: https://github.com/Instrument/instrument-serif
- Geist Regular and Medium, by Vercel: https://github.com/vercel/geist-font

Both are under the SIL Open Font License 1.1: https://openfontlicense.org
