# Mainnet Metadata Assets

Run `npm run prepare:metadata` to generate `artifacts/mainnet-metadata/`.

The generated metadata pack is for owner review and upload to a persistent public HTTPS host.
The app does not upload assets automatically, because automatic uploads to unknown services can
substitute metadata, create hidden dependencies, or expose credentials.

Required mainnet environment values after upload:

- `NEXT_PUBLIC_SATA_IMAGE_URI=<persistent HTTPS image URL>`
- `NEXT_PUBLIC_SATA_METADATA_URI=<persistent HTTPS metadata JSON URL>`

Do not use localhost, temporary links, private buckets, expiring signed URLs, or unreviewed upload
services for mainnet metadata.
