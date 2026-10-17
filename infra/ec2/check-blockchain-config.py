#!/usr/bin/env python3
"""Validate resolved EC2 Compose config before any running service is replaced."""
import json
import stat
import sys
from pathlib import Path


def check(config, root):
    services = config["services"]
    env = services["blockchain-service"].get("environment", {})
    for flag in ("MINT_ENABLED", "PURCHASE_ENABLED"):
        if env.get(flag) not in ("true", "false"):
            raise ValueError(f"Set {flag}=true or false in blockchain-service/.env")

    key_path = root / "services/blockchain-service/.secrets/devnet-sponsor.json"
    if not key_path.is_file():
        raise ValueError("Securely copy the existing Devnet sponsor key to "
                         "services/blockchain-service/.secrets/devnet-sponsor.json")
    if key_path.parent.stat().st_mode & 0o077:
        raise ValueError("Set sponsor directory permissions to 700 (chmod 700)")
    if stat.S_IMODE(key_path.stat().st_mode) != 0o600:
        raise ValueError("Set sponsor key permissions to 600 (chmod 600)")
    try:
        key = json.loads(key_path.read_text())
    except (OSError, ValueError):
        raise ValueError("Unable to read a valid sponsor key JSON file") from None
    if not isinstance(key, list) or len(key) != 64 or not all(
        type(n) is int and 0 <= n <= 255 for n in key
    ):
        raise ValueError("Sponsor key must be a 64-byte Solana keypair JSON array")

    if env["PURCHASE_ENABLED"] == "true":
        token = env.get("INTERNAL_SERVICE_TOKEN")
        if not isinstance(token, str) or len(token) < 32:
            raise ValueError("INTERNAL_SERVICE_TOKEN must contain at least 32 characters")
        for name in ("auth-service", "main-api"):
            if services[name].get("environment", {}).get("INTERNAL_SERVICE_TOKEN") != token:
                raise ValueError(f"INTERNAL_SERVICE_TOKEN must match in {name} and blockchain-service")

    print(f"Blockchain preflight passed: MINT_ENABLED={env['MINT_ENABLED']}, "
          f"PURCHASE_ENABLED={env['PURCHASE_ENABLED']}")


if __name__ == "__main__":
    try:
        check(json.load(sys.stdin), Path(__file__).resolve().parents[2])
    except (ValueError, KeyError, OSError) as error:
        # Never dump Compose configuration, parsed secret values, or tracebacks.
        message = "Unable to read blockchain deployment configuration"
        if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError):
            message = str(error)
        print(f"Blockchain preflight failed: {message}", file=sys.stderr)
        sys.exit(1)
