"use client";

import { ConnectButton } from '@rainbow-me/rainbowkit';

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    style={{
                      backgroundColor: "#000",
                      color: "#fff",
                      border: "2px solid #fff",
                      borderRadius: 0,
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "8px 16px",
                      height: "auto",
                      lineHeight: 1.4,
                      cursor: "pointer",
                    }}
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    style={{
                      backgroundColor: "#000",
                      color: "#f00",
                      border: "2px solid #f00",
                      borderRadius: 0,
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "8px 16px",
                      height: "auto",
                      lineHeight: 1.4,
                      cursor: "pointer",
                    }}
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <button
                  onClick={openAccountModal}
                  type="button"
                  style={{
                    backgroundColor: "#000",
                    color: "#fff",
                    border: "2px solid #fff",
                    borderRadius: 0,
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "8px 16px",
                    height: "auto",
                    lineHeight: 1.4,
                    cursor: "pointer",
                  }}
                >
                  {account.displayName}
                </button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
