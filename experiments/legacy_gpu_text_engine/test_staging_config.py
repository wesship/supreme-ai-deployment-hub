import os
import unittest
from unittest.mock import patch
from staging_config import StagingConfig


class StagingConfigTests(unittest.TestCase):
    def test_missing_tenant_rejected(self):
        with patch.dict(os.environ, {"D3VONN_TEXT_ENGINE_TOKEN": "x" * 40}, clear=True):
            with self.assertRaises(ValueError):
                StagingConfig.from_environment()

    def test_valid_single_tenant_cpu(self):
        with patch.dict(os.environ, {"D3VONN_TEXT_ENGINE_TOKEN": "x" * 40,
                                     "D3VONN_TEXT_ENGINE_TENANT_ID": "hermes-staging"}, clear=True):
            cfg = StagingConfig.from_environment()
            self.assertEqual(cfg.host, "127.0.0.1")

    def test_multi_tenant_and_gpu_rejected(self):
        env = {"D3VONN_TEXT_ENGINE_TOKEN": "x" * 40,
               "D3VONN_TEXT_ENGINE_TENANT_ID": "hermes-staging"}
        for key, value in [("D3VONN_TEXT_ENGINE_MULTI_TENANT", "true"),
                           ("D3VONN_TEXT_ENGINE_BACKEND", "cuda")]:
            with patch.dict(os.environ, {**env, key: value}, clear=True):
                with self.assertRaises(ValueError):
                    StagingConfig.from_environment()


if __name__ == "__main__":
    unittest.main()
