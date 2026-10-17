import pathlib
import unittest


class CudaContractTests(unittest.TestCase):
    def test_kernel_source_and_explicit_limitations(self):
        root = pathlib.Path(__file__).parent / "cuda"
        source = (root / "substring.cu").read_text()
        notes = (root / "README.md").read_text()
        self.assertIn("match_kernel", source)
        self.assertIn("cudaGetLastError", source)
        self.assertIn("not** equivalent", notes)
        self.assertIn("No GPU testing has been performed", notes)


if __name__ == "__main__":
    unittest.main()
