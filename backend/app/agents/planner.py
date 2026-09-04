from typing import List, Dict, Any

class AgentPlanner:
    """
    Industrial Task Planner.
    Breaks high-level user requests into actionable tool executions.
    """

    @classmethod
    def create_plan(cls, user_prompt: str, machine_id: str = None) -> List[Dict[str, Any]]:
        prompt_lower = user_prompt.lower()
        target = machine_id or ("Machine-002" if "machine-002" in prompt_lower else "Machine-001")

        # Standard Industrial Diagnostic & Maintenance Plan
        if "analyze" in prompt_lower or "report" in prompt_lower or "diagnose" in prompt_lower:
            return [
                {
                    "step_number": 1,
                    "action": "Query Digital Twin for asset structure and current state",
                    "tool": "query_digital_twin",
                    "args": {"machine_id": target}
                },
                {
                    "step_number": 2,
                    "action": "Fetch real-time multi-sensor telemetry history",
                    "tool": "fetch_telemetry",
                    "args": {"machine_id": target}
                },
                {
                    "step_number": 3,
                    "action": "Traverse Knowledge Graph for past failures and causal incident chains",
                    "tool": "query_knowledge_graph",
                    "args": {"machine_id": target}
                },
                {
                    "step_number": 4,
                    "action": "Perform Private RAG retrieval for relevant maintenance SOP manuals",
                    "tool": "run_rag_search",
                    "args": {"query": f"{target} bearing vibration lubrication SOP"}
                },
                {
                    "step_number": 5,
                    "action": "Evaluate deterministic safety rules against active telemetry",
                    "tool": "evaluate_safety_state",
                    "args": {"machine_id": target}
                },
                {
                    "step_number": 6,
                    "action": "Synthesize comprehensive maintenance report via Sovereign AI",
                    "tool": None,
                    "args": {}
                }
            ]
        elif "simulate" in prompt_lower or "what-if" in prompt_lower:
            return [
                {
                    "step_number": 1,
                    "action": "Execute What-If simulation on virtual twin",
                    "tool": "execute_what_if_simulation",
                    "args": {"machine_id": target, "temp_delta": 15.0, "vibration_delta": 1.2}
                },
                {
                    "step_number": 2,
                    "action": "Analyze virtual safety impact and prepare risk forecast",
                    "tool": None,
                    "args": {}
                }
            ]
        else:
            return [
                {
                    "step_number": 1,
                    "action": "Retrieve relevant technical documentation via RAG",
                    "tool": "run_rag_search",
                    "args": {"query": user_prompt}
                },
                {
                    "step_number": 2,
                    "action": "Synthesize grounded answer",
                    "tool": None,
                    "args": {}
                }
            ]
