import time
import uuid
import json
import re
from typing import Dict, List, Any, Optional
from app.ai.task_classifier import TaskClassifier, CapabilityRegistry
from app.agents.tools.registry import ToolRegistry
from app.ai.gateway import model_gateway
from app.safety.approval import ApprovalService
from app.core.audit import AuditLogger

class OrchestrationState:
    INITIALIZING = "INITIALIZING"
    INTENT_ANALYSIS = "INTENT_ANALYSIS"
    WORKFLOW_PLANNING = "WORKFLOW_PLANNING"
    EXECUTING_STEPS = "EXECUTING_STEPS"
    PAUSED_FOR_APPROVAL = "PAUSED_FOR_APPROVAL"
    FINAL_SYNTHESIS = "FINAL_SYNTHESIS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class SovereignOrchestrator:
    """
    Sovereign Agentic Local Orchestrator ("The Brain").
    
    Coordinates:
      1. Multi-modal Intent Analysis (Semantic Dense Vector Embeddings)
      2. Workflow Planning (3-Level Hierarchy: Semantic -> Local LLM -> Heuristic)
      3. Hardware-Aware Tool & Model Execution Loop (Max 10 steps, timeout safe)
      4. Controlled Action Gate (Human-In-The-Loop Approval checkpoint)
      5. Prompt Injection Barrier (Untrusted document text encapsulated as DATA)
      6. Context Accumulator & Grounded Synthesis
      7. Full Audit & Execution Trace
    """

    MAX_EXECUTION_STEPS = 10
    _recent_traces: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def get_trace(cls, request_id: str) -> Optional[Dict[str, Any]]:
        return cls._recent_traces.get(request_id)

    @classmethod
    def get_all_traces(cls, limit: int = 20) -> List[Dict[str, Any]]:
        return list(cls._recent_traces.values())[-limit:][::-1]

    @classmethod
    def plan_workflow(
        cls,
        prompt: str,
        machine_id: Optional[str] = None,
        file_path: Optional[str] = None,
        file_type: Optional[str] = None,
        user: str = "operator",
        user_role: str = "ENGINEER"
    ) -> Dict[str, Any]:
        """
        Formulates a structured multi-step execution plan using the 3-level decision hierarchy.
        """
        plan_id = f"PLAN-{uuid.uuid4().hex[:8].upper()}"
        
        # 1. Semantic Intent Analysis (Dense Vector Embeddings)
        classification = TaskClassifier.classify(
            prompt=prompt,
            has_machine=bool(machine_id),
            has_rag_context=bool(file_path or "manual" in prompt.lower() or "sop" in prompt.lower()),
            has_graph_facts="why" in prompt.lower() or "cause" in prompt.lower()
        )

        detected_task = classification["task_type"]
        confidence = classification["confidence"]
        workflow_seq = classification.get("workflow_sequence") or classification.get("workflow_tasks") or [detected_task]
        is_ambiguous = classification.get("is_ambiguous", False)


        planning_level = "LEVEL_1_SEMANTIC"
        steps: List[Dict[str, Any]] = []

        # Level 2 LLM Planner check: If confidence is low or ambiguous, attempt local LLM structured refinement
        if (confidence < 0.55 or is_ambiguous) and len(workflow_seq) <= 1:
            try:
                llm_plan_steps = cls._plan_via_local_llm(prompt, machine_id, file_path)
                if llm_plan_steps:
                    steps = llm_plan_steps
                    planning_level = "LEVEL_2_LLM_PLANNER"
            except Exception:
                pass

        # If Level 2 was not used or did not produce steps, construct steps from Level 1 semantic workflow sequence
        if not steps:
            target_mach = machine_id or ("Machine-002" if "machine-002" in prompt.lower() else "Machine-001")
            steps = cls._build_steps_from_sequence(
                sequence=workflow_seq,
                prompt=prompt,
                machine_id=target_mach,
                file_path=file_path,
                file_type=file_type
            )
            planning_level = "LEVEL_1_SEMANTIC"

        # Level 3 Heuristic Fallback check: If steps list is empty, construct deterministic fallback
        if not steps:
            steps = cls._build_heuristic_fallback_steps(prompt, machine_id)
            planning_level = "LEVEL_3_HEURISTIC"

        # Deterministic Safety Interlock: Industrial safety mandates approval for shutdown or physical actuator override
        p_lower = prompt.lower()
        if any(w in p_lower for w in ["shutdown", "shut down", "halt motor", "trip circuit", "override actuator"]):
            has_approval_step = any(s.get("requires_approval") for s in steps)
            if not has_approval_step:
                target_mach = machine_id or ("Machine-002" if "machine-002" in prompt.lower() else "Machine-001")
                insert_pos = max(0, len(steps) - 1) if steps else 0
                steps.insert(insert_pos, {
                    "step_number": insert_pos + 1,
                    "action": f"Trigger emergency actuator shutdown on {target_mach}",
                    "capability": "REASONING",
                    "handler_type": "TOOL",
                    "tool_or_model": "request_human_approval",
                    "args": {"action_type": "EMERGENCY_SHUTDOWN", "target_resource": target_mach},
                    "requires_approval": True,
                    "action_type": "EMERGENCY_SHUTDOWN"
                })
                for idx, s in enumerate(steps, start=1):
                    s["step_number"] = idx

        return {
            "plan_id": plan_id,
            "prompt": prompt,
            "detected_intent": detected_task,
            "confidence": round(confidence, 4),
            "is_compound": len(workflow_seq) > 1,
            "workflow_sequence": workflow_seq,
            "planning_level": planning_level,
            "steps": steps,
            "total_steps": len(steps)
        }

    @classmethod
    def execute_workflow(
        cls,
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
        Executes the planned workflow through the real LangGraph StateGraph engine
        with tool resolution, human approval gates, prompt injection sandboxing,
        and execution trace logging.
        """
        start_time = time.time()
        from app.agents.graph_orchestrator import langgraph_orchestrator

        lg_res = langgraph_orchestrator.execute(
            prompt=prompt,
            user=user,
            user_role=user_role,
            machine_id=machine_id,
            file_path=file_path,
            file_type=file_type,
            auto_approve_controlled=auto_approve_controlled,
            conversation_history=conversation_history
        )

        total_time_ms = round((time.time() - start_time) * 1000, 2)
        request_id = lg_res.get("request_id") or f"ORCH-{uuid.uuid4().hex[:8].upper()}"

        # Map execution trace to ensure standard keys for legacy and frontend compatibility
        mapped_trace = []
        for step in lg_res.get("execution_trace", []):
            mapped_trace.append({
                "step_number": step.get("step_number", 1),
                "action": step.get("objective", step.get("action", "")),
                "capability": step.get("agent_type", step.get("capability", "REASONING")),
                "handler_type": "AGENT",
                "target": f"{step.get('agent_type', 'Specialized')}Agent",
                "status": step.get("status", "COMPLETED"),
                "input_data": step.get("data", {}),
                "output_summary": step.get("output_summary", ""),
                "execution_time_ms": step.get("execution_time_ms", 0.0),
                "approval_id": step.get("data", {}).get("request_id") if isinstance(step.get("data"), dict) else None
            })

        trace_record = {
            "request_id": request_id,
            "prompt": prompt,
            "status": lg_res.get("status", OrchestrationState.COMPLETED),
            "detected_intent": lg_res.get("detected_intent", "GENERAL_LLM"),
            "planning_level": lg_res.get("planning_level", "LANGGRAPH_STATEGRAPH_LLM"),
            "confidence": lg_res.get("confidence", 0.95),
            "steps_executed": len(mapped_trace),
            "execution_trace": mapped_trace,
            "total_time_ms": total_time_ms,
            "final_answer": lg_res.get("final_answer", ""),
            "model_used": lg_res.get("model_used", "Local Sovereign Model"),
            "is_fallback": lg_res.get("is_fallback", False),
            "pending_approval": lg_res.get("pending_approval"),
            "citations": lg_res.get("citations", []),
            "knowledge_facts": lg_res.get("knowledge_facts", []),
            "safety_check": "PASSED" if not lg_res.get("pending_approval") else "WAITING_APPROVAL"
        }

        cls._recent_traces[request_id] = trace_record
        return trace_record



    # -------------------------------------------------------------
    # Helper Methods for Planning
    # -------------------------------------------------------------

    @classmethod
    def _build_steps_from_sequence(
        cls,
        sequence: List[str],
        prompt: str,
        machine_id: str,
        file_path: Optional[str],
        file_type: Optional[str]
    ) -> List[Dict[str, Any]]:
        steps: List[Dict[str, Any]] = []
        step_idx = 1

        for cap in sequence:
            reg_item = CapabilityRegistry.get_capability(cap)
            
            if cap == "OCR":
                steps.append({
                    "step_number": step_idx,
                    "action": "Extract optical text from uploaded scanned document/image",
                    "capability": "OCR",
                    "handler_type": "TOOL",
                    "tool_or_model": "extract_ocr_text",
                    "args": {"file_path": file_path or "document.pdf", "file_type": file_type or "SCANNED_PDF", "machine_id": machine_id},
                    "requires_approval": False
                })
                step_idx += 1

            elif cap == "DOCUMENT_ANALYSIS" or cap == "PDF_PROCESSING":
                steps.append({
                    "step_number": step_idx,
                    "action": "Parse document layout, tables, and inspection sections",
                    "capability": "DOCUMENT_ANALYSIS",
                    "handler_type": "TOOL",
                    "tool_or_model": "parse_document_pages",
                    "args": {"file_path": file_path or "document.pdf"},
                    "requires_approval": False
                })
                step_idx += 1

            elif cap == "TELEMETRY_ANALYSIS":
                steps.append({
                    "step_number": step_idx,
                    "action": f"Fetch live multi-sensor telemetry history for {machine_id}",
                    "capability": "TELEMETRY_ANALYSIS",
                    "handler_type": "TOOL",
                    "tool_or_model": "fetch_telemetry",
                    "args": {"machine_id": machine_id},
                    "requires_approval": False
                })
                step_idx += 1
                steps.append({
                    "step_number": step_idx,
                    "action": f"Evaluate deterministic ISO safety thresholds for {machine_id}",
                    "capability": "TELEMETRY_ANALYSIS",
                    "handler_type": "TOOL",
                    "tool_or_model": "evaluate_safety_state",
                    "args": {"machine_id": machine_id},
                    "requires_approval": False
                })
                step_idx += 1

            elif cap == "SOP_RAG":
                steps.append({
                    "step_number": step_idx,
                    "action": "Perform Private Hybrid RAG search for relevant SOP manuals",
                    "capability": "SOP_RAG",
                    "handler_type": "TOOL",
                    "tool_or_model": "run_rag_search",
                    "args": {"query": f"{machine_id} {prompt[:80]}"},
                    "requires_approval": False
                })
                step_idx += 1

            elif cap == "GRAPH_RAG":
                steps.append({
                    "step_number": step_idx,
                    "action": f"Traverse industrial knowledge graph for causal chains on {machine_id}",
                    "capability": "GRAPH_RAG",
                    "handler_type": "TOOL",
                    "tool_or_model": "query_knowledge_graph",
                    "args": {"machine_id": machine_id},
                    "requires_approval": False
                })
                step_idx += 1

            elif cap == "CALCULATOR":
                steps.append({
                    "step_number": step_idx,
                    "action": "Compute engineering formula & remaining useful life metrics",
                    "capability": "CALCULATOR",
                    "handler_type": "TOOL",
                    "tool_or_model": "calculate_engineering_formula",
                    "args": {"formula": "vibration_severity", "variables": {"rms_velocity": 3.8}},
                    "requires_approval": False
                })
                step_idx += 1

            elif cap == "PYTHON_EXECUTION":
                steps.append({
                    "step_number": step_idx,
                    "action": "Execute isolated Python simulation script in sandbox",
                    "capability": "PYTHON_EXECUTION",
                    "handler_type": "TOOL",
                    "tool_or_model": "execute_python_sandbox",
                    "args": {"code": "result = {'status': 'SIMULATION_OK', 'stress_index': 0.74}"},
                    "requires_approval": False
                })
                step_idx += 1

        # Check if controlled action is required (e.g. prompt mentions shutdown or change parameter)
        p_lower = prompt.lower()
        if any(w in p_lower for w in ["shutdown", "shut down", "halt motor", "trip circuit", "override actuator"]):
            steps.append({
                "step_number": step_idx,
                "action": f"Trigger emergency actuator shutdown on {machine_id}",
                "capability": "REASONING",
                "handler_type": "TOOL",
                "tool_or_model": "request_human_approval",
                "args": {"action_type": "EMERGENCY_SHUTDOWN", "target_resource": machine_id},
                "requires_approval": True,
                "action_type": "EMERGENCY_SHUTDOWN"
            })
            step_idx += 1

        # Always terminate with a grounded Synthesis / Reasoning step
        if "GENERAL_LLM" in sequence and len(sequence) == 1:
            action_desc = "Synthesize response using Sovereign Assistant"
            cap_desc = "GENERAL_LLM"
        elif "CODE" in sequence and len(sequence) == 1:
            action_desc = "Generate code solution using Sovereign Assistant"
            cap_desc = "CODE"
        else:
            action_desc = "Synthesize grounded diagnostic assessment and actionable recommendation"
            cap_desc = "REASONING"

        steps.append({
            "step_number": step_idx,
            "action": action_desc,
            "capability": cap_desc,
            "handler_type": "MODEL",
            "tool_or_model": "Local Sovereign Model",
            "args": {"prompt": prompt},
            "requires_approval": False
        })

        return steps

    @classmethod
    def _plan_via_local_llm(
        cls,
        prompt: str,
        machine_id: Optional[str],
        file_path: Optional[str]
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Level 2 Planner: Prompts the local GGUF model to output a clean JSON step plan.
        If a local GGUF model is loaded, it executes structured inference.
        If running in native fallback mode or JSON parsing fails, cleanly returns None.
        """
        try:
            planner_prompt = (
                "You are the Sovereign AI Agent Planner. Formulate an execution plan as a JSON list of steps.\n"
                "Available capabilities: [OCR, DOCUMENT_ANALYSIS, TELEMETRY_ANALYSIS, SOP_RAG, GRAPH_RAG, CALCULATOR, PYTHON_EXECUTION, GENERAL_LLM, REASONING].\n"
                "Output ONLY a valid JSON array of objects with keys: 'step_number', 'action', 'capability', 'tool_or_model', 'args', 'requires_approval'.\n"
                f"User Request: {prompt}\n"
                f"Target Machine: {machine_id or 'Machine-001'}\n"
                "JSON Plan:"
            )
            gw_result = model_gateway.process_request(
                prompt=planner_prompt,
                user="orchestrator_planner",
                task_type="AGENT_PLANNER"
            )

            # If no local GGUF model installed on disk, return None to proceed with Level 1 Semantic Plan
            if gw_result.get("is_fallback", False) or "Native" in gw_result.get("model_used", ""):
                return None

            raw_text = gw_result.get("response", "")
            match = re.search(r'\[\s*\{.*\}\s*\]', raw_text, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
                if isinstance(parsed, list) and len(parsed) > 0:
                    validated_steps = []
                    available_tools = ToolRegistry.list_tools() if hasattr(ToolRegistry, "list_tools") else []
                    for i, step in enumerate(parsed[:cls.MAX_EXECUTION_STEPS], 1):
                        validated_steps.append({
                            "step_number": i,
                            "action": step.get("action", f"Execute step {i}"),
                            "capability": step.get("capability", "REASONING"),
                            "handler_type": step.get("handler_type", "TOOL" if step.get("tool_or_model") in available_tools else "MODEL"),
                            "tool_or_model": step.get("tool_or_model", "Local Sovereign Model"),
                            "args": step.get("args", {}),
                            "requires_approval": bool(step.get("requires_approval", False))
                        })
                    return validated_steps
        except Exception as e:
            print(f"[Orchestrator] Level 2 LLM planning exception: {e}")
        return None

    @classmethod
    def _build_heuristic_fallback_steps(cls, prompt: str, machine_id: Optional[str]) -> List[Dict[str, Any]]:
        """
        Level 3 Heuristic Fallback Planner: Deterministic safe sequence.
        """
        target = machine_id or "Machine-001"
        return [
            {
                "step_number": 1,
                "action": f"Retrieve relevant technical documentation via RAG for {target}",
                "capability": "SOP_RAG",
                "handler_type": "TOOL",
                "tool_or_model": "run_rag_search",
                "args": {"query": prompt},
                "requires_approval": False
            },
            {
                "step_number": 2,
                "action": "Synthesize grounded engineering response",
                "capability": "REASONING",
                "handler_type": "MODEL",
                "tool_or_model": "Local Sovereign Model",
                "args": {"prompt": prompt},
                "requires_approval": False
            }
        ]
