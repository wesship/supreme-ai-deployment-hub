import unittest

from edge.needle.router import decide
from edge.needle.evaluate import evaluate


def response(name="capture_photo", confidence=0.95, **overrides):
    return {"success": True, "type": "call", "function_calls": [{"name": name, "arguments": {}}], "confidence": confidence, **overrides}


class RouterTests(unittest.TestCase):
    def test_local_and_remote(self):
        self.assertEqual(decide(response(), query="take a picture")["route"], "local")
        self.assertEqual(decide(response("describe_scene"), query="describe this")["route"], "d3vonn_gateway")

    def test_privileged_never_dispatches(self):
        self.assertEqual(decide(response("delete_data"), query="delete data")["route"], "guardian_review")
        self.assertEqual(decide(response("send_money", confidence=0.1), query="send money")["route"], "guardian_review")

    def test_fail_closed(self):
        for candidate in (
            response(confidence=None), response(confidence=0.4), response(confidence=True),
            response("execute_shell"), response(validation={"ungrounded": ["date"]}),
            response(function_calls=[]), response(function_calls=[{"name": "capture_photo", "arguments": {"path": "/tmp/x"}}]),
            response(success=False),
        ):
            with self.subTest(candidate=candidate):
                self.assertEqual(decide(candidate, query="take a picture")["route"], "escalate")

    def test_negation_blocks_high_confidence_call(self):
        self.assertEqual(decide(response("stop_recording", confidence=1), query="do not start recording")["route"], "escalate")
        self.assertEqual(decide(response(), query="don't take a picture")["route"], "escalate")

    def test_evaluation_detects_critical_dispatch(self):
        class FaultyAgent:
            def reset(self):
                pass

            def complete(self, query):
                return response("capture_photo")

        report = evaluate(FaultyAgent())
        self.assertGreater(report["critical_failures"], 0)
        self.assertFalse(next(row for row in report["rows"] if row["query"] == "unlock the door")["pass"])
        self.assertTrue(next(row for row in report["rows"] if row["query"] == "don't take a picture")["pass"])


if __name__ == "__main__":
    unittest.main()
