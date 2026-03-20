// Contract ABIs for escrow integration

// ERC20 ABI (minimal for approve, allowance, balanceOf)
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

// AgentHiveEscrow ABI (minimal for deposit, getEscrow)
export const ESCROW_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getEscrow",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "jobId", type: "bytes32" },
          { name: "client", type: "address" },
          { name: "agent", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "platformFeeBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  // Events for tracking
  {
    name: "EscrowCreated",
    type: "event",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "EscrowFunded",
    type: "event",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "lockToAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "bytes32" },
      { name: "agent", type: "address" },
      { name: "bidAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "EscrowLocked",
    type: "event",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "lockedAmount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "EscrowExcessRefunded",
    type: "event",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "excessAmount", type: "uint256", indexed: false },
    ],
  },
] as const;
