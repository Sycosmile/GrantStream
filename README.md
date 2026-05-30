# GrantStream

On-chain grant milestone disbursement protocol. Funders lock grant funds and release them automatically as grantees hit verifiable milestones — no trust required.

## Problem
Most grants are paid upfront or in arbitrary tranches with no accountability. Grantees ghost. Funders have no recourse.

## Solution
GrantStream locks funds in a smart contract and releases each tranche only when a milestone is submitted and approved by a designated verifier (or a DAO vote).

## Tech Stack
- Frontend: React + Tailwind
- Smart contracts: Solidity (Hardhat)
- Storage: IPFS for milestone evidence
- Chain: Optimism / Base

## Features
- Create grants with N milestones and per-milestone amounts
- Grantees submit evidence per milestone
- Verifiers approve/reject on-chain
- Funds auto-release on approval
- Full audit trail

## Status
MVP — hackathon prototype. Contracts deployed on Base Sepolia testnet.
