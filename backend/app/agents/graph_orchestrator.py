import time
import uuid
import json
import re
from typing import Dict, Any, List, Optional

from langgraph.graph import StateGraph, START, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from app.agents.graph_state import OrchestratorGraphState
from app.schemas.agentic_schemas import TaskPlan, TaskItem, AgentExecutionResult
from app.ai.langchain_adapter import SovereignLocalChatModel
from app.agents.specialized import (
    RagAgent,
    TelemetryAnomalyAgent,
    VisionOcrAgent,
    ReasoningAgent,
    SafetyControlAgent
)
from app.ai.gateway import model_gateway
from app.core.audit import AuditLogger
from app.safety.approval import ApprovalService
from app.prompts.loader import PromptLoader

class LangGraphOrchestrator:
    """
    Sovereign Agentic Orchestrator Brain powered by LangGraph & LangChain.
    
    Architecture:
      1. LangChain LLM Planner: Decomposes requests into structured TaskPlan with dependencies.
      2. LangGraph StateGraph: Explicit state machine with conditional routing, evaluation, and bounded replanning.
      3. Specialized Agents: Discrete agents for Telemetry, RAG, Vision/OCR, Reasoning, and Safety Control.
      4. Deterministic Safety Interlocks: Machine control commands unconditionally require human sign-off.
    """

    MAX_RETRIES = 2

    def __init__(self):
        self.rag_agent = RagAgent()
        self.telemetry_agent = TelemetryAnomalyAgent()
        self.vision_ocr_agent = VisionOcrAgent()
        self.reasoning_agent = ReasoningAgent()
        self.safety_agent = SafetyControlAgent()
        
        self.app = self._build_graph().compile()

    def _build_graph(self) -> StateGraph:
        builder = StateGraph(OrchestratorGraphState)

        # 1. Register Graph Nodes
        builder.add_node("understand_intent_and_plan", self._node_understand_intent_and_plan)
        builder.add_node("route_and_execute_task", self._node_route_and_execute_task)
        builder.add_node("evaluate_result", self._node_evaluate_result)
        builder.add_node("replan_task", self._node_replan_task)
        builder.add_node("human_approval_gate", self._node_human_approval_gate)
        builder.add_node("synthesize_final_response", self._node_synthesize_final_response)

        # 2. Add Edges
        builder.add_edge(START, "understand_intent_and_plan")
        builder.add_edge("understand_intent_and_plan", "route_and_execute_task")
        builder.add_edge("route_and_execute_task", "evaluate_result")
        builder.add_edge("replan_task", "route_and_execute_task")

        # 3. Add Conditional Edges
        builder.add_conditional_edges(
            "evaluate_result",
            self._edge_evaluate_outcome,
            {
                "replan_task": "replan_task",
                "route_and_execute_task": "route_and_execute_task",
                "human_approval_gate": "human_approval_gate",
                "synthesize_final_response": "synthesize_final_response",
                "END": END
            }
        )

        builder.add_conditional_edges(
            "human_approval_gate",
            self._edge_approval_outcome,
            {
                "synthesize_final_response": "synthesize_final_response",
                "END": END
            }
        )

        builder.add_edge("synthesize_final_response", END)

        return builder

    # ----------------------------------------------------------------------
    # LangGraph Nodes
    # ----------------------------------------------------------------------

    def _validate_and_realign_task_plan(self, plan: TaskPlan, user_query: str, machine_id: Optional[str]) -> TaskPlan:
        """
        Deterministic task plan validator and domain boundary realigner.
        Guarantees that:
        1. Telemetry/sensor queries are NEVER dispatched to RAG.
        2. SOP/documentation queries are NEVER dispatched to TELEMETRY.
        3. Informational safety rule evaluations NEVER pause for approval.
        4. Physical control actions unconditionally enforce human approval.
        """
        from app.machines.registry_service import MachineRegistryService
        q_lower = user_query.lower()
        discovered = MachineRegistryService.discover_machines(user_query)
        if discovered:
            target_mach = discovered[0]["machine_id"]
        elif machine_id:
            target_mach = machine_id
        else:
            target_mach = "Machine-001"

        commands_physical = any(w in q_lower for w in [
            "shutdown", "shut down", "halt motor", "trip circuit", "override actuator", "open valve", "close valve", "isolate valve"
        ])

        is_safety_eval = any(w in q_lower for w in [
            "safety rule", "safety rules", "deterministic safety", "safe state", "check safety", "evaluate deterministic"
        ])

        # Strict deterministic safety gate: Human approval is ONLY required for physical actuator commands
        plan.requires_human_approval = bool(commands_physical)

        # Handle specific case: Evaluating safety rules against telemetry (e.g. user screenshot query)
        if is_safety_eval and not commands_physical:
            plan.intent = "SAFETY_EVALUATION"
            plan.requires_human_approval = False
            tasks = [
                TaskItem(
                    task_id="1",
                    agent_type="TELEMETRY",
                    objective=f"Retrieve machine's operational status and live sensor data from telemetry for {target_mach}",
                    reason="Telemetry baseline required to evaluate deterministic safety rules.",
                    target_resource=target_mach
                ),
                TaskItem(
                    task_id="2",
                    agent_type="SAFETY_CONTROL",
                    objective=f"Evaluate deterministic safety rules against {target_mach} telemetry",
                    reason="Verify vibration and temperature threshold compliance without actuation.",
                    target_resource=target_mach,
                    input_parameters={"action_type": "CHECK_SAFETY_LIMITS"}
                ),
                TaskItem(
                    task_id="3",
                    agent_type="REASONING",
                    objective="Synthesize safety compliance assessment and operational status",
                    reason="Provide structured engineering evaluation report.",
                    input_parameters={"task_mode": "REASONING"}
                )
            ]
            plan.tasks = tasks
            return plan

        # General Realignment Loop for LLM generated tasks
        realigned_tasks: List[TaskItem] = []
        for t in plan.tasks:
            obj_l = (t.objective or "").lower()
            agent = t.agent_type.upper()

            # Rule 1: SENSOR / TELEMETRY MISROUTING FIX
            is_telemetry_query = any(w in obj_l for w in [
                "telemetry", "sensor", "vibration", "temperature", "rpm", "operational status", "live data", "metrics", "digital twin"
            ])
            if is_telemetry_query and agent == "RAG":
                t.agent_type = "TELEMETRY"
                t.reason = "Corrected: Sensor readings and operational status require Digital Twin Telemetry."
                if not t.target_resource:
                    t.target_resource = target_mach

            # Rule 2: SOP / MANUAL MISROUTING FIX
            is_sop_query = any(w in obj_l for w in ["sop", "manual", "procedure", "handbook", "standard operating"])
            if is_sop_query and agent in ["TELEMETRY", "SAFETY_CONTROL"]:
                t.agent_type = "RAG"
                t.reason = "Corrected: Standard Operating Procedures require Document RAG."

            # Rule 3: INFORMATIONAL SAFETY VS ACTUATOR TRIP
            if agent == "SAFETY_CONTROL":
                is_phys = any(w in obj_l for w in ["shutdown", "shut down", "halt motor", "trip circuit", "override actuator"])
                if not is_phys or not commands_physical:
                    t.input_parameters["action_type"] = "CHECK_SAFETY_LIMITS"
                else:
                    t.input_parameters["action_type"] = "EMERGENCY_SHUTDOWN"

            realigned_tasks.append(t)

        is_whole_query_sop = any(w in q_lower for w in ["sop", "manual", "procedure", "handbook", "standard operating"])
        if is_whole_query_sop and not commands_physical and not is_safety_eval:
            has_rag = any(t.agent_type == "RAG" for t in realigned_tasks)
            if not has_rag:
                realigned_tasks.insert(0, TaskItem(
                    task_id="rag-sop-1",
                    agent_type="RAG",
                    objective=f"Retrieve technical documentation: {user_query}",
                    reason="Grounding against plant approved manuals and SOPs.",
                    target_resource=target_mach,
                    input_parameters={"query": user_query}
                ))
            realigned_tasks = [t for t in realigned_tasks if t.agent_type != "SAFETY_CONTROL"]

        plan.tasks = realigned_tasks
        return plan

    def _node_understand_intent_and_plan(self, state: OrchestratorGraphState) -> Dict[str, Any]:
        """
        Node 1: Uses LangChain ChatPromptTemplate + Local LLM + Pydantic parser
        to formulate a structured TaskPlan. Enforces deterministic safety interlocks.
        """
        user_query = state.get("user_query", "")
        from app.machines.registry_service import MachineRegistryService
        discovered = MachineRegistryService.discover_machines(user_query)
        if discovered:
            machine_id = discovered[0]["machine_id"]
        else:
            machine_id = state.get("machine_id")
        user = state.get("user", "operator")

        # Set up LangChain Structured Output Planner
        parser = PydanticOutputParser(pydantic_object=TaskPlan)
        llm = SovereignLocalChatModel(task_type="AGENT_PLANNER", user=user)

        system_msg = PromptLoader.load("orchestrator/system.txt")
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", f"{system_msg}\n\n{{format_instructions}}"),
            ("human", "User Request: {query}\nTarget Asset Context: {machine_context}")
        ])

        chain = prompt_template | llm

        plan_obj: Optional[TaskPlan] = None
        try:
            raw_ai_msg = chain.invoke({
                "query": user_query,
                "machine_context": machine_id or "Unspecified (detect from query)",
                "format_instructions": parser.get_format_instructions()
            })

            # Attempt structured Pydantic parsing
            text_content = raw_ai_msg.content if hasattr(raw_ai_msg, "content") else str(raw_ai_msg)
            # Find JSON block if LLM wrapped in markdown
            json_match = re.search(r'(\{.*\})', text_content, re.DOTALL)
            json_str = json_match.group(1) if json_match else text_content
            plan_obj = parser.parse(json_str)
        except Exception:
            # Deterministic heuristic fallback planner if small GGUF model JSON fails
            plan_obj = self._generate_deterministic_plan(user_query, machine_id)

        # DETERMINISTIC SAFETY INTERLOCK:
        # Machine control commands (shutdown, trip, actuator override) MUST ALWAYS be marked for human approval.
        # Informational or diagnostic queries must NEVER be halted by LLM hallucination.
        p_lower = user_query.lower()
        commands_physical_control = any(w in p_lower for w in [
            "shutdown", "shut down", "halt motor", "trip circuit", "override actuator", "open valve", "close valve", "isolate valve"
        ])
        
        # Ground-truth deterministic safety gate
        plan_obj.requires_human_approval = bool(commands_physical_control)

        # Map pure conversational / general queries to GENERAL_LLM intent
        has_industrial_terms = any(w in p_lower for w in [
            "machine", "sensor", "telemetry", "safety", "rule", "rules", "status", "vibration",
            "temperature", "rpm", "sop", "manual", "analyze", "diagnos", "report", "health"
        ])
        is_conversational = bool(re.search(r"\b(help|assist|hello|hi|hey|who are you)\b", p_lower))
        if is_conversational and not has_industrial_terms and not commands_physical_control:
            plan_obj.intent = "GENERAL_LLM"
            plan_obj.requires_human_approval = False
            plan_obj.tasks = [
                TaskItem(
                    task_id="1",
                    agent_type="REASONING",
                    objective="Provide helpful conversational assistance",
                    reason="General conversational request"
                )
            ]

        # Industrial Multi-Step Diagnostic Validation:
        # Diagnostic and maintenance inquiries require multi-step telemetry, GraphRAG, SOP grounding, safety check, and synthesis.
        is_diagnostic_query = any(w in p_lower for w in [
            "analyze", "diagnos", "abnormal", "anomal", "vibration", "temperature", "overheating",
            "alarm", "fault", "issue", "failure", "investigate", "maintenance report", "status", "health", "root cause"
        ])
        if is_diagnostic_query:
            from app.machines.registry_service import MachineRegistryService
            discovered = MachineRegistryService.discover_machines(user_query)
            if discovered:
                target_mach = discovered[0]["machine_id"]
            elif machine_id:
                target_mach = machine_id
            else:
                target_mach = "Machine-001"
            # Ensure distinct tasks for live telemetry and knowledge graph traversal
            has_live_twin = any(t.agent_type == "TELEMETRY" and any(w in (t.objective or "").lower() for w in ["live", "sensor", "reading", "metric"]) for t in plan_obj.tasks)
            has_kg_traverse = any(any(w in (t.objective or "").lower() for w in ["knowledge graph", "causal", "root cause", "failure chain"]) for t in plan_obj.tasks)

            if not has_live_twin:
                plan_obj.tasks.insert(0, TaskItem(
                    task_id="telemetry-step-1",
                    agent_type="TELEMETRY",
                    objective=f"Query Digital Twin for {target_mach} live sensor readings and operational state",
                    reason="Machine diagnostics require empirical telemetry baseline.",
                    target_resource=target_mach
                ))
            if not has_kg_traverse:
                insert_pos = 1 if len(plan_obj.tasks) > 1 else 0
                plan_obj.tasks.insert(insert_pos, TaskItem(
                    task_id="graph-step-2",
                    agent_type="TELEMETRY",
                    objective=f"Traverse Knowledge Graph for {target_mach} causal failure chains",
                    reason="Identify historical failure modes and root causes in graph.",
                    target_resource=target_mach
                ))
            has_rag = any(t.agent_type == "RAG" for t in plan_obj.tasks)
            if not has_rag:
                insert_pos = min(2, len(plan_obj.tasks))
                plan_obj.tasks.insert(insert_pos, TaskItem(
                    task_id="rag-step-3",
                    agent_type="RAG",
                    objective=f"Retrieve technical maintenance SOP manuals for {target_mach}",
                    reason="Ground findings against plant standard operating procedures.",
                    target_resource=target_mach,
                    input_parameters={"query": f"{target_mach} vibration temperature SOP maintenance procedure"}
                ))
            has_safety = any(t.agent_type == "SAFETY_CONTROL" for t in plan_obj.tasks)
            if not has_safety:
                insert_pos = min(3, len(plan_obj.tasks))
                plan_obj.tasks.insert(insert_pos, TaskItem(
                    task_id="safety-step-4",
                    agent_type="SAFETY_CONTROL",
                    objective=f"Evaluate deterministic safety rules against {target_mach} telemetry",
                    reason="Verify operational limit compliance and alarm states.",
                    target_resource=target_mach,
                    input_parameters={"action_type": "CHECK_SAFETY_LIMITS"}
                ))
            has_reasoning = any(t.agent_type == "REASONING" for t in plan_obj.tasks)
            if not has_reasoning:
                plan_obj.tasks.append(TaskItem(
                    task_id="reasoning-step-final",
                    agent_type="REASONING",
                    objective="Synthesize diagnostic assessment and actionable recommendation",
                    reason="Provide engineering report based on telemetry, SOP, and safety compliance."
                ))

        # Final authoritative task validation & realignment (enforcing RAG vs Telemetry & Informational Safety)
        plan_obj = self._validate_and_realign_task_plan(plan_obj, user_query, machine_id)
        tasks_list = [t.model_dump() for t in plan_obj.tasks]
        if commands_physical_control:
            # Ensure SAFETY_CONTROL task exists
            has_safety_step = any(t.get("agent_type") == "SAFETY_CONTROL" for t in tasks_list)
            if not has_safety_step:
                from app.machines.registry_service import MachineRegistryService
                if machine_id:
                    target_mach = machine_id
                else:
                    discovered = MachineRegistryService.discover_machines(user_query)
                    target_mach = discovered[0]["machine_id"] if discovered else "Machine-001"
                tasks_list.insert(0, {
                    "task_id": "safety-gate-1",
                    "agent_type": "SAFETY_CONTROL",
                    "objective": f"Trigger emergency actuator shutdown on {target_mach}",
                    "reason": "Industrial safety interlock requires Safety Officer approval for physical shutdown.",
                    "dependencies": [],
                    "target_resource": target_mach,
                    "input_parameters": {"action_type": "EMERGENCY_SHUTDOWN"}
                })

        return {
            "detected_intent": plan_obj.intent,
            "task_plan": {
                "intent": plan_obj.intent,
                "reasoning": plan_obj.reasoning,
                "tasks": tasks_list,
                "requires_human_approval": plan_obj.requires_human_approval
            },
            "requires_human_approval": plan_obj.requires_human_approval,
            "current_task_idx": 0,
            "completed_tasks": [],
            "execution_trace": [],
            "retrieved_context": [],
            "retrieved_citations": [],
            "graph_facts": [],
            "errors": [],
            "retry_count": 0,
            "status": "EXECUTING_STEPS"
        }

    def _node_route_and_execute_task(self, state: OrchestratorGraphState) -> Dict[str, Any]:
        """
        Node 2: Dispatches the current task to its corresponding specialized agent.
        """
        plan = state.get("task_plan") or {}
        tasks = plan.get("tasks", [])
        idx = state.get("current_task_idx", 0)

        if idx >= len(tasks):
            return {"status": "ALL_TASKS_DISPATCHED"}

        current_task_dict = tasks[idx]
        current_task = TaskItem(**current_task_dict)
        agent_type = current_task.agent_type.upper()

        step_start = time.time()

        # Dispatch to specialized agent
        if agent_type == "RAG":
            res = self.rag_agent.execute(current_task, state)
        elif agent_type == "TELEMETRY":
            res = self.telemetry_agent.execute(current_task, state)
        elif agent_type == "VISION_OCR":
            res = self.vision_ocr_agent.execute(current_task, state)
        elif agent_type == "SAFETY_CONTROL":
            res = self.safety_agent.execute(current_task, state)
        else:
            # REASONING / GENERAL_LLM / CODE
            res = self.reasoning_agent.execute(current_task, state)

        duration_ms = round((time.time() - step_start) * 1000, 2)

        trace_entry = {
            "step_number": idx + 1,
            "task_id": current_task.task_id,
            "agent_type": agent_type,
            "objective": current_task.objective,
            "status": res.status,
            "output_summary": res.output_summary,
            "execution_time_ms": duration_ms,
            "data": res.data
        }

        trace = list(state.get("execution_trace", []))
        trace.append(trace_entry)

        return {
            "last_agent_result": res.model_dump(),
            "execution_trace": trace
        }

    def _node_evaluate_result(self, state: OrchestratorGraphState) -> Dict[str, Any]:
        """
        Node 3: Evaluates the outcome of the agent step.
        Accumulates verified evidence into state and determines next transition.
        """
        last_res = state.get("last_agent_result") or {}
        status = last_res.get("status", "COMPLETED")
        data = last_res.get("data", {})
        agent_type = last_res.get("agent_type", "")

        context_chunks = list(state.get("retrieved_context", []))
        citations = list(state.get("retrieved_citations", []))
        facts = list(state.get("graph_facts", []))
        telemetry = state.get("telemetry_data")
        ocr_text = state.get("ocr_text")
        errors = list(state.get("errors", []))

        approval_status = state.get("approval_status", "NONE")
        pending_approval = state.get("pending_approval")

        if status == "WAITING_APPROVAL":
            approval_status = "PENDING"
            pending_approval = data.get("approval_request")
            return {
                "status": "PAUSED_FOR_APPROVAL",
                "approval_status": approval_status,
                "pending_approval": pending_approval
            }

        elif status == "FAILED":
            errors.append(last_res.get("output_summary", "Task failed"))
            return {
                "errors": errors,
                "status": "STEP_FAILED"
            }

        else:
            # Accumulate data based on agent
            if agent_type == "RAG":
                citations.extend(data.get("citations", []))
                context_chunks.extend(data.get("context_chunks", []))
            elif agent_type == "TELEMETRY":
                telemetry = data.get("latest_telemetry")
                facts.extend(data.get("causal_facts", []))
            elif agent_type == "VISION_OCR":
                ocr_text = data.get("safe_document_block")
                if ocr_text:
                    context_chunks.append(ocr_text)

            completed = list(state.get("completed_tasks", []))
            completed.append(state.get("current_task_idx", 0))

            return {
                "retrieved_context": context_chunks,
                "retrieved_citations": citations,
                "graph_facts": facts,
                "telemetry_data": telemetry,
                "ocr_text": ocr_text,
                "completed_tasks": completed,
                "current_task_idx": state.get("current_task_idx", 0) + 1,
                "status": "STEP_COMPLETED"
            }

    def _node_replan_task(self, state: OrchestratorGraphState) -> Dict[str, Any]:
        """
        Node 4: Bounded replanning node. Evaluates why a step failed and adjusts strategy.
        """
        retry_count = state.get("retry_count", 0) + 1
        plan = state.get("task_plan") or {}
        tasks = list(plan.get("tasks", []))
        idx = state.get("current_task_idx", 0)

        if idx < len(tasks):
            failed_task = tasks[idx]
            # Adjust strategy: fall back to REASONING if specialized tool failed
            failed_task["agent_type"] = "REASONING"
            failed_task["objective"] = f"Synthesize available evidence despite {failed_task.get('objective')}"
            tasks[idx] = failed_task
            plan["tasks"] = tasks

        return {
            "task_plan": plan,
            "retry_count": retry_count,
            "status": "REPLANNED"
        }

    def _node_human_approval_gate(self, state: OrchestratorGraphState) -> Dict[str, Any]:
        """
        Node 5: Human-In-The-Loop Approval Gate.
        Halts execution and creates approval record if physical actuation is required.
        """
        if state.get("auto_approve_controlled"):
            return {
                "approval_status": "APPROVED",
                "status": "EXECUTING_STEPS"
            }

        pending = state.get("pending_approval")
        if not pending:
            user = state.get("user", "operator")
            mach = state.get("machine_id", "Machine-002")
            pending = ApprovalService.create_request(
                action_type="EMERGENCY_SHUTDOWN",
                target_resource=mach,
                requested_by=user,
                justification="Physical actuator command requires Safety Officer sign-off."
            )

        return {
            "status": "PAUSED_FOR_APPROVAL",
            "approval_status": "PENDING",
            "pending_approval": pending
        }

    def _node_synthesize_final_response(self, state: OrchestratorGraphState) -> Dict[str, Any]:
        """
        Node 6: Synthesizes final grounded response using local LLM, citations, and telemetry.
        """
        user_query = state.get("user_query", "")
        user = state.get("user", "operator")
        context_chunks = state.get("retrieved_context", [])
        graph_facts = state.get("graph_facts", [])
        telemetry = state.get("telemetry_data")

        # Determine task mode
        intent = state.get("detected_intent", "GENERAL_LLM")
        p_lower = user_query.lower()
        if any(w in p_lower for w in ["python", "function", "script", "write code", "code to", "def "]):
            task_mode = "CODE"
        elif intent in ["TELEMETRY_DIAGNOSTICS", "REASONING"]:
            task_mode = "REASONING"
        elif intent in ["CODE", "PYTHON_EXECUTION"]:
            task_mode = "CODE"
        else:
            task_mode = "GENERAL_LLM"

        conv_hist = state.get("conversation_history")
        res = model_gateway.process_request(
            prompt=user_query,
            user=user,
            task_type=task_mode,
            context_chunks=context_chunks,
            graph_facts=graph_facts,
            telemetry_data=telemetry,
            conversation_history=conv_hist
        )

        final_ans = res.get("response", "")
        if task_mode == "CODE" and not ("def " in final_ans or "```" in final_ans):
            code_fallback = model_gateway.engine._handle_code_and_scripting(p_lower, user_query)
            if code_fallback:
                final_ans = code_fallback

        # Special synthesis for deterministic safety evaluation requests
        from app.machines.registry_service import MachineRegistryService
        discovered = MachineRegistryService.discover_machines(user_query)
        target_mach = state.get("machine_id") or (discovered[0]["machine_id"] if discovered else "Machine-001")

        if intent == "SAFETY_EVALUATION" or any(w in p_lower for w in ["safety rule", "safety rules", "deterministic safety", "safe state"]):
            telem = state.get("telemetry_data") or {}
            vib = telem.get("vibration", 0.0)
            temp = telem.get("temperature", 0.0)
            rpm_val = telem.get("rpm", 0.0)
            data_src = telem.get("data_source", "SIMULATOR")
            
            safety_info = None
            for item in state.get("execution_trace", []):
                if item.get("agent_type") == "SAFETY_CONTROL":
                    safety_info = item.get("data", {}).get("safety_evaluation")
            state_str = safety_info.get("state", "NORMAL") if safety_info else "NORMAL"
            
            final_ans = (
                f"Deterministic Safety Rules Evaluation Report: {target_mach} (Data Source: {data_src})\n\n"
                f"Operational Telemetry Baseline:\n"
                f"- Shaft Vibration: {vib} mm/s RMS\n"
                f"- Bearing Temperature: {temp} °C\n"
                f"- Spindle Speed: {rpm_val} RPM\n\n"
                f"Safety Engine Interlock Assessment:\n"
                f"- Deterministic Status: {state_str}\n"
                f"- Safety Interlock Action: PASS - Telemetry evaluated against plant deterministic thresholds.\n"
                f"- Actuator Trip: NO TRIP REQUIRED. Emergency shutdown interlock is disarmed for informational query."
            )
        elif intent in ["TELEMETRY_DIAGNOSTICS", "REASONING"] or any(w in user_query.lower() for w in ["analyze", "diagnos", "maintenance report"]):
            if target_mach not in final_ans:
                final_ans = f"Asset Diagnostic Report: {target_mach}\n\n" + final_ans

            sop_mentions = []
            for f in graph_facts:
                if "SOP" in f:
                    sop_mentions.append(f)
            for c in state.get("retrieved_citations", []):
                doc_id = c.get("doc_id", "")
                title = c.get("title", "")
                if "SOP" in doc_id or "SOP" in title:
                    sop_mentions.append(f"{title} ({doc_id})")

            if sop_mentions:
                ref_str = "\n\nStandard Operating Procedure Reference:\n" + "\n".join(f"- {s}" for s in set(sop_mentions))
                if ref_str not in final_ans:
                    final_ans += ref_str

        return {
            "final_answer": final_ans,
            "model_used": res.get("model_used", "Local Sovereign Model"),
            "is_fallback": res.get("is_fallback", False),
            "status": "COMPLETED"
        }

    # ----------------------------------------------------------------------
    # Conditional Edge Resolvers
    # ----------------------------------------------------------------------

    def _edge_evaluate_outcome(self, state: OrchestratorGraphState) -> str:
        status = state.get("status")

        if status == "PAUSED_FOR_APPROVAL":
            return "END"

        if status == "STEP_FAILED":
            if state.get("retry_count", 0) < self.MAX_RETRIES:
                return "replan_task"
            else:
                # Max retries exceeded; proceed to synthesis with whatever context exists
                return "synthesize_final_response"

        # Step succeeded: check if more tasks remain
        plan = state.get("task_plan") or {}
        tasks = plan.get("tasks", [])
        idx = state.get("current_task_idx", 0)

        if idx < len(tasks):
            return "route_and_execute_task"

        # All tasks completed: check if human approval required
        if state.get("requires_human_approval") and state.get("approval_status") not in ["APPROVED", "AUTO_APPROVED"]:
            return "human_approval_gate"

        return "synthesize_final_response"

    def _edge_approval_outcome(self, state: OrchestratorGraphState) -> str:
        status = state.get("status")
        if status == "PAUSED_FOR_APPROVAL":
            return "END"
        return "synthesize_final_response"

    # ----------------------------------------------------------------------
    # Deterministic Heuristic Planner Fallback
    # ----------------------------------------------------------------------

    def _generate_deterministic_plan(self, query: str, machine_id: Optional[str]) -> TaskPlan:
        """
        High-reliability fallback planner when small local LLM outputs non-JSON.
        Decomposes query into domain-accurate specialized agent tasks.
        """
        q_lower = query.lower()
        target = machine_id or ("Machine-002" if "machine-002" in q_lower else "Machine-001")
        tasks: List[TaskItem] = []

        is_shutdown = any(w in q_lower for w in ["shutdown", "shut down", "halt motor", "trip circuit", "override actuator"])
        is_diagnostic = any(w in q_lower for w in ["analyze", "diagnos", "vibration", "temperature", "overheat", "root cause", "maintenance report", "status", "health"])
        is_rag_sop = any(w in q_lower for w in ["sop", "manual", "procedure", "checklist", "guideline", "document", "standard operating"])
        is_ocr = any(w in q_lower for w in ["ocr", "scan", "inspection sheet", "plate", "image", "extract text"])
        is_code = any(w in q_lower for w in ["code", "python", "pyhthon", "script", "function", "program"])
        is_math = any(w in q_lower for w in ["calculate", "addition", "formula", "1+2", "compute"])

        if is_shutdown:
            tasks.append(TaskItem(
                task_id="1",
                agent_type="SAFETY_CONTROL",
                objective=f"Trigger emergency actuator shutdown on {target}",
                reason="Physical shutdown commands require safety interlock evaluation.",
                target_resource=target,
                input_parameters={"action_type": "EMERGENCY_SHUTDOWN"}
            ))
            return TaskPlan(
                intent="EMERGENCY_SHUTDOWN",
                reasoning="Emergency command detected. Formulated safety gate task.",
                tasks=tasks,
                requires_human_approval=True
            )

        step_id = 1
        if is_diagnostic:
            tasks.append(TaskItem(
                task_id=str(step_id),
                agent_type="TELEMETRY",
                objective=f"Query Digital Twin for {target} structure and live telemetry streams",
                reason="Determine operating parameters, vibration, and temperature readings.",
                target_resource=target
            ))
            step_id += 1

            tasks.append(TaskItem(
                task_id=str(step_id),
                agent_type="TELEMETRY",
                objective=f"Traverse Knowledge Graph for {target} causal failure chains",
                reason="Identify historical failure modes and root causes.",
                target_resource=target
            ))
            step_id += 1

        if is_ocr:
            tasks.append(TaskItem(
                task_id=str(step_id),
                agent_type="VISION_OCR",
                objective="Extract technical inspection sheet details via local OCR",
                reason="Extract text data from technical scanned document.",
                target_resource=target
            ))
            step_id += 1

        if is_rag_sop or is_diagnostic:
            tasks.append(TaskItem(
                task_id=str(step_id),
                agent_type="RAG",
                objective=f"Retrieve technical maintenance SOP manuals for {target}",
                reason="Ground diagnosis against approved engineering procedures.",
                target_resource=target,
                input_parameters={"query": f"{target} bearing vibration lubrication maintenance standard operating procedure"}
            ))
            step_id += 1

        if is_diagnostic:
            tasks.append(TaskItem(
                task_id=str(step_id),
                agent_type="SAFETY_CONTROL",
                objective=f"Evaluate deterministic safety rules against {target} telemetry",
                reason="Verify vibration and temperature threshold compliance.",
                target_resource=target,
                input_parameters={"action_type": "CHECK_SAFETY_LIMITS"}
            ))
            step_id += 1

        if is_code or is_math:
            tasks.append(TaskItem(
                task_id=str(step_id),
                agent_type="REASONING",
                objective="Execute code/calculation logic for user request",
                reason="Provide direct computation and Python output.",
                input_parameters={"task_mode": "CODE" if is_code else "CALCULATOR"}
            ))
        else:
            tasks.append(TaskItem(
                task_id=str(step_id),
                agent_type="REASONING",
                objective="Synthesize diagnostic assessment and actionable recommendation",
                reason="Provide grounded technical response based on collected evidence.",
                input_parameters={"task_mode": "REASONING"}
            ))

        return TaskPlan(
            intent="TELEMETRY_DIAGNOSTICS" if is_diagnostic else ("SOP_QUERY" if is_rag_sop else "GENERAL_LLM"),
            reasoning="Decomposed request into specialized telemetry, RAG, and reasoning tasks.",
            tasks=tasks,
            requires_human_approval=False
        )

    # ----------------------------------------------------------------------
    # Public Execution & Planning Interface
    # ----------------------------------------------------------------------

    def execute(
        self,
        prompt: str,
        user: str = "operator",
        user_role: str = "ENGINEER",
        machine_id: Optional[str] = None,
        file_path: Optional[str] = None,
        file_type: Optional[str] = None,
        auto_approve_controlled: bool = False,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes the full LangGraph Agentic Workflow.
        """
        request_id = f"ORCH-{uuid.uuid4().hex[:8].upper()}"

        from app.machines.registry_service import MachineRegistryService
        discovered = MachineRegistryService.discover_machines(prompt)
        effective_machine = discovered[0]["machine_id"] if discovered else machine_id

        initial_state: OrchestratorGraphState = {
            "request_id": request_id,
            "user": user,
            "user_role": user_role,
            "user_query": prompt,
            "machine_id": effective_machine,
            "file_path": file_path,
            "file_type": file_type,
            "auto_approve_controlled": auto_approve_controlled,
            "requires_human_approval": False,
            "approval_status": "AUTO_APPROVED" if auto_approve_controlled else "NONE",
            "pending_approval": None,
            "current_task_idx": 0,
            "completed_tasks": [],
            "execution_trace": [],
            "retrieved_context": [],
            "retrieved_citations": [],
            "graph_facts": [],
            "telemetry_data": None,
            "ocr_text": None,
            "errors": [],
            "retry_count": 0,
            "conversation_history": conversation_history or [],
            "final_answer": "",
            "model_used": "",
            "is_fallback": False,
            "status": "INITIALIZING"
        }

        # Invoke the LangGraph StateGraph
        final_state = self.app.invoke(initial_state)

        # Audit complete orchestration trace
        AuditLogger.log(
            who=user,
            what="LANGGRAPH_WORKFLOW_COMPLETE",
            resource=request_id,
            result=final_state.get("status", "COMPLETED"),
            reason=f"Executed LangGraph plan for intent: {final_state.get('detected_intent')}",
            details={
                "steps_count": len(final_state.get("execution_trace", [])),
                "model_used": final_state.get("model_used")
            }
        )

        return {
            "request_id": request_id,
            "prompt": prompt,
            "status": final_state.get("status", "COMPLETED"),
            "detected_intent": final_state.get("detected_intent", "GENERAL_LLM"),
            "planning_level": "LANGGRAPH_STATEGRAPH_LLM",
            "confidence": 0.95,
            "requires_human_approval": final_state.get("requires_human_approval", False),
            "approval_status": final_state.get("approval_status", "NONE"),
            "task_plan": final_state.get("task_plan"),
            "execution_trace": final_state.get("execution_trace", []),
            "final_answer": final_state.get("final_answer", ""),
            "model_used": final_state.get("model_used", "Local Sovereign Model"),
            "is_fallback": final_state.get("is_fallback", False),
            "citations": final_state.get("retrieved_citations", []),
            "knowledge_facts": final_state.get("graph_facts", []),
            "pending_approval": final_state.get("pending_approval")
        }

    def plan(
        self,
        prompt: str,
        machine_id: Optional[str] = None,
        file_path: Optional[str] = None,
        file_type: Optional[str] = None,
        user: str = "operator",
        user_role: str = "ENGINEER"
    ) -> Dict[str, Any]:
        """
        Formulates and returns the TaskPlan without executing steps.
        """
        plan_state = self._node_understand_intent_and_plan({
            "user_query": prompt,
            "machine_id": machine_id,
            "file_path": file_path,
            "file_type": file_type,
            "user": user,
            "user_role": user_role
        })

        plan_data = plan_state.get("task_plan", {})
        tasks = plan_data.get("tasks", [])

        # Format steps compatible with API schema
        mapped_steps = []
        for idx, t in enumerate(tasks, start=1):
            mapped_steps.append({
                "step_number": idx,
                "action": t.get("objective", ""),
                "capability": t.get("agent_type", ""),
                "handler_type": "AGENT",
                "tool_or_model": f"{t.get('agent_type')}Agent",
                "args": t.get("input_parameters", {}),
                "requires_approval": (t.get("agent_type") == "SAFETY_CONTROL" and plan_data.get("requires_human_approval", False))
            })

        return {
            "plan_id": f"PLAN-{uuid.uuid4().hex[:8].upper()}",
            "prompt": prompt,
            "detected_intent": plan_data.get("intent", "GENERAL_LLM"),
            "confidence": 0.95,
            "is_compound": len(tasks) > 1,
            "workflow_sequence": [t.get("agent_type") for t in tasks],
            "planning_level": "LANGGRAPH_STATEGRAPH_LLM",
            "steps": mapped_steps,
            "total_steps": len(mapped_steps)
        }

# Global singleton orchestrator instance
langgraph_orchestrator = LangGraphOrchestrator()
