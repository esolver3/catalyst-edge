import unittest
from agent_team.run import run


class AgentTeamTests(unittest.TestCase):
    def test_simulation_only(self):
        report = run()
        self.assertEqual(report["mode"], "simulation")
        self.assertEqual(report["summary"]["agents"], 6)
        self.assertTrue(all(job["external_actions"] == 0 for job in report["jobs"]))
        self.assertTrue(all(job["needs_approval"] for job in report["jobs"]))


if __name__ == "__main__":
    unittest.main()
