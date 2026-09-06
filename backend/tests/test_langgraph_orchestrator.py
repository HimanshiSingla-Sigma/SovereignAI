import unittest
from app.agents.graph_orchestrator import LangGraphOrchestrator, langgraph_orchestrator
from app.schemas.agentic_schemas import TaskPlan, TaskItem, AgentExecutionResult
from app.agents.specialized import (
    RagAgent,
    TelemetryAnomalyAgent,
    VisionOcrAgent,
    ReasoningAgent,
    SafetyControlAgent
)
from app.safety.approval import ApprovalService

class TestLangGraphAgenticArchitecture(unittest.TestCase):
    """
    Comprehensive verification tests for the genuine LangGraph + LangChain Agentic Architecture.
    Validates:
      1. LangGraph StateGraph compilation and execution.
      2. Structured Pydantic Output validation (TaskPlan schema).
      3. Discrete Specialized Agent execution and contracts.
      4. Dynamic evaluation and bounded replanning without infinite loops.
      5. Deterministic Human-In-The-Loop approval gate.
    """

    def setUp(self):
        self.orchestrator = langgraph_orchestrator

    def test_langgraph_compilation_and_nodes(self):
        """Verify the StateGraph compiles with all 6 required nodes."""
        self.assertIsNotNone(self.orchestrator.app)
        # Check node names in graph
        nodes = self.orchestrator.app.get_graph().nodes
        expected_nodes = [
            "understand_intent_and_plan",
            "route_and_execute_task",
            "evaluate_result",
            "replan_task",
            "human_approval_gate",
            "synthesize_final_response"
        ]
        for node in expected_nodes:
            self.assertIn(node, nodes, f"LangGraph node '{node}' is missing from StateGraph.")

    def test_structured_pydantic_task_plan_validation(self):
        """Verify TaskPlan schema validation with typed task items."""
        sample_plan = TaskPlan(
            intent="PUMP_DIAGNOSTICS",
            reasoning="Decomposed pump query into telemetry and manual QA.",
            tasks=[
                TaskItem(
                    task_id="1",
                    agent_type="TELEMETRY",
                    objective="Fetch vibration history",
                    reason="Verify vibration baseline",
                    target_resource="Machine-001"
                ),
                TaskItem(
                    task_id="2",
                    agent_type="RAG",
                    objective="Search pump alignment SOP",
                    reason="Compare against standard tolerances",
                    dependencies=["1"]
                )
            ],
            requires_human_approval=False
        )
        self.assertEqual(sample_plan.intent, "PUMP_DIAGNOSTICS")
        self.assertEqual(len(sample_plan.tasks), 2)
        self.assertEqual(sample_plan.tasks[0].agent_type, "TELEMETRY")
        self.assertEqual(sample_plan.tasks[1].dependencies, ["1"])

    def test_specialized_rag_agent(self):
        """Verify RagAgent retrieves verified technical documents."""
        agent = RagAgent()
        task = TaskItem(
            task_id="1",
            agent_type="RAG",
            objective="Retrieve bearing vibration lubrication SOP",
            reason="Ground diagnosis against plant guidelines",
            target_resource="Machine-002",
            input_parameters={"query": "Machine-002 bearing vibration lubrication SOP"}
        )
        state = {"user": "test_engineer", "user_role": "ENGINEER", "machine_id": "Machine-002"}
        result = agent.execute(task, state)
        self.assertIsInstance(result, AgentExecutionResult)
        self.assertEqual(result.agent_type, "RAG")
        self.assertEqual(result.status, "COMPLETED")
        self.assertIn("citations", result.data)

    def test_specialized_telemetry_agent(self):
        """Verify TelemetryAnomalyAgent retrieves live sensor data and twin structure."""
        agent = TelemetryAnomalyAgent()
        task = TaskItem(
            task_id="1",
            agent_type="TELEMETRY",
            objective="Query Machine-002 structure and telemetry",
            reason="Check vibration and temperature",
            target_resource="Machine-002"
        )
        state = {"user": "test_engineer", "user_role": "ENGINEER", "machine_id": "Machine-002"}
        result = agent.execute(task, state)
        self.assertEqual(result.agent_type, "TELEMETRY")
        self.assertEqual(result.status, "COMPLETED")
        self.assertIn("latest_telemetry", result.data)
        self.assertIn("vibration", result.data["latest_telemetry"])

    def test_specialized_vision_ocr_agent_sandbox(self):
        """Verify VisionOcrAgent wraps extracted document text in untrusted security boundary."""
        agent = VisionOcrAgent()
        task = TaskItem(
            task_id="1",
            agent_type="VISION_OCR",
            objective="Extract inspection sheet notes",
            reason="Document analysis",
            target_resource="Machine-001"
        )
        state = {"user": "test_engineer", "user_role": "ENGINEER", "machine_id": "Machine-001"}
        result = agent.execute(task, state)
        self.assertEqual(result.agent_type, "VISION_OCR")
        self.assertEqual(result.status, "COMPLETED")
        self.assertIn("<untrusted_document_data", result.data.get("safe_document_block", ""))
        self.assertIn("[SECURITY NOTICE:", result.data.get("safe_document_block", ""))

    def test_deterministic_safety_gate_halts_for_approval(self):
        """Verify that emergency shutdown commands halt at human_approval_gate."""
        res = self.orchestrator.execute(
            prompt="Emergency shutdown the motor on Machine-002 immediately due to fire hazard",
            user="operator",
            user_role="ENGINEER",
            machine_id="Machine-002",
            auto_approve_controlled=False
        )
        self.assertEqual(res["status"], "PAUSED_FOR_APPROVAL")
        self.assertIsNotNone(res["pending_approval"])
        self.assertEqual(res["pending_approval"]["action_type"], "EMERGENCY_SHUTDOWN")
        self.assertTrue(res["pending_approval"]["request_id"].startswith("APPR-"))

    def test_pre_authorized_actuator_action_completes(self):
        """Verify that pre-authorized controlled actions execute without pausing."""
        res = self.orchestrator.execute(
            prompt="Emergency shutdown Machine-001",
            user="safety_officer",
            user_role="SAFETY_OFFICER",
            machine_id="Machine-001",
            auto_approve_controlled=True
        )
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIsNone(res["pending_approval"])

    def test_langgraph_end_to_end_multistep_workflow(self):
        """Verify complete multi-step agentic diagnostic journey."""
        res = self.orchestrator.execute(
            prompt="Analyze Machine-002 and prepare a maintenance report.",
            user="operator",
            user_role="ENGINEER",
            machine_id="Machine-002"
        )
        self.assertEqual(res["status"], "COMPLETED")
        self.assertEqual(res["planning_level"], "LANGGRAPH_STATEGRAPH_LLM")
        self.assertGreaterEqual(len(res["execution_trace"]), 3)
        self.assertIsNotNone(res["final_answer"])
        self.assertTrue(len(res["final_answer"]) > 10)


if __name__ == "__main__":
    unittest.main()
