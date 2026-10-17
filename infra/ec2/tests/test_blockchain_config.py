import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "blockchain_config", Path(__file__).resolve().parents[1] / "check-blockchain-config.py"
)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class BlockchainConfigTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.key = self.root / "services/blockchain-service/.secrets/devnet-sponsor.json"
        self.key.parent.mkdir(parents=True, mode=0o700)
        self.key.write_text(json.dumps(list(range(64))))
        self.key.chmod(0o600)
        token = "test-only-token-01234567890123456789"
        self.config = {"services": {name: {"environment": {"INTERNAL_SERVICE_TOKEN": token}}
                                    for name in ("auth-service", "main-api", "blockchain-service")}}
        self.env = self.config["services"]["blockchain-service"]["environment"]
        self.env.update(MINT_ENABLED="true", PURCHASE_ENABLED="true")

    def check(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            validator.check(self.config, self.root)
        return output.getvalue()

    def test_valid_configuration_reports_flags_without_secrets(self):
        output = self.check()
        self.assertIn("PURCHASE_ENABLED=true", output)
        self.assertNotIn(self.env["INTERNAL_SERVICE_TOKEN"], output)

    def test_missing_or_invalid_flags_fail(self):
        for value in (None, "", "TRUE", True):
            self.env["MINT_ENABLED"] = value
            with self.assertRaisesRegex(ValueError, "MINT_ENABLED"):
                self.check()

    def test_purchases_require_matching_tokens_in_all_three_services(self):
        for name in ("auth-service", "main-api", "blockchain-service"):
            with self.subTest(name=name):
                env = self.config["services"][name]["environment"]
                original = env.pop("INTERNAL_SERVICE_TOKEN")
                with self.assertRaisesRegex(ValueError, "INTERNAL_SERVICE_TOKEN"):
                    self.check()
                env["INTERNAL_SERVICE_TOKEN"] = original
        self.config["services"]["main-api"]["environment"]["INTERNAL_SERVICE_TOKEN"] = "different-token-01234567890123456789"
        with self.assertRaisesRegex(ValueError, "must match"):
            self.check()

    def test_explicitly_disabled_purchases_allow_staged_setup(self):
        self.env.update(MINT_ENABLED="false", PURCHASE_ENABLED="false", INTERNAL_SERVICE_TOKEN="")
        self.assertIn("PURCHASE_ENABLED=false", self.check())

    def test_missing_invalid_or_exposed_key_fails(self):
        self.key.chmod(0o644)
        with self.assertRaisesRegex(ValueError, "permissions to 600"):
            self.check()
        self.key.chmod(0o600)
        self.key.parent.chmod(0o755)
        with self.assertRaisesRegex(ValueError, "directory permissions to 700"):
            self.check()
        self.key.parent.chmod(0o700)
        for content in ("not-json-sensitive-content", "{}", "[1, 2]", json.dumps([True] * 64)):
            self.key.write_text(content)
            with self.assertRaises(ValueError) as raised:
                self.check()
            self.assertNotIn(content, str(raised.exception))
        self.key.unlink()
        with self.assertRaisesRegex(ValueError, "existing Devnet sponsor"):
            self.check()


if __name__ == "__main__":
    unittest.main()
