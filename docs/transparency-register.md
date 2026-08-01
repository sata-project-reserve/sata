# SATA Transparency Register

This register is the public-source template for SATA facts that should be easy to verify.

## Solana

- SATA mint: `A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH`
- Token program: standard SPL Token Program
- Raydium CPMM SATA/WSOL pool: `CYRZoXLjgNFTQJnvyJpym1wfTAEoGz6kJMYJFb5hUd8e`
- Raydium CPMM program: `CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C`
- Raydium LP-Lock / Burn & Earn program: `LockrWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpofwE`
- Initial verified LP lock transaction: `6r2o4X88cZZ8HZZtk1nvCUdFGqvHcr1ByUVZddHyfqcRCeEAjD7pFghLvrJtgU5sEKA78ZEBc37rr7pcBDgD7Qn`
- Locked LP amount from latest verification: `9199123117269` LP base units
- Fee Key NFT mint: `FQq3W44pup68ux6rEZR91AX77Nwth8rH49m9aSouGpT6`

## Bitcoin Reserve

Status: first tranche confirmed with signed address proof.

Reserve address: `bc1q7dgqqyfh7gxn2kze874d07w4qcj43v4zptv6kk`.

Planned first tranche: `500,000 sats` (`0.005 BTC`).

Proof message:

`SATA Bitcoin reserve address for Solana mint A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH. No redemption promise. Snapshot UTC: 2026-08-01T13:20:55Z.`

Proof signature:

`AkcwRAIgTuFktugOzK4NVrAQFqvymy3gREk6LMV8AW9JTE7GvPACIBr8A6wMdHcm2nnN7NuxQmc9ZluTRPabRpp6cwwM9EKpASECMkly6+9vvZrpsgNHhFcSpklkpaluJV8IEsjNLweRTMk=`

Required before public reserve claim:

- Dedicated BTC address.
- On-chain BTC balance.
- Signed message proving control.
- Timestamped reserve report.

The first tranche can be described as balance-verified with signed address proof. It must still not be described as a redemption promise, guaranteed price floor, or risk-free backing.

## Current Reserve Ratio Template

When the `500,000 sats` first tranche is published and verified:

- `1 SATA ~= 1/2000 sat`
- `1 sat ~= 2,000 SATA`
- `1 sat per 1 SATA` treasury milestone currently requires `999,996,854 sats` (`9.99996854 BTC`)

## Public Wording

Preferred:

`SATA has a public Bitcoin treasury reserve ratio that anyone can verify from the published BTC address and signed proof. The reserve is not a redemption promise or guaranteed price floor.`

Avoid:

- `fully backed`
- `guaranteed value`
- `price floor`
- `risk free`
- `redeemable for BTC`
- `locked forever` unless referring only to independently verified LP-lock accounts
