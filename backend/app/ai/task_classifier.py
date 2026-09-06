import re
import math
from typing import Dict, Any, Optional, List, Tuple
from app.rag.embeddings import LocalEmbeddingEngine

class TaskType:
    GENERAL_LLM = 'GENERAL_LLM'
    REASONING = 'REASONING'
    AGENT_PLANNER = 'AGENT_PLANNER'
    SOP_RAG = 'SOP_RAG'
    OCR = 'OCR'
    VISION = 'VISION'
    DOCUMENT_ANALYSIS = 'DOCUMENT_ANALYSIS'
    TELEMETRY_ANALYSIS = 'TELEMETRY_ANALYSIS'
    CODE = 'CODE'
    SPREADSHEET = 'SPREADSHEET'
    PDF_PROCESSING = 'PDF_PROCESSING'
    GRAPH_RAG = 'GRAPH_RAG'
    CALCULATOR = 'CALCULATOR'
    PYTHON_EXECUTION = 'PYTHON_EXECUTION'
    EMBEDDING = 'EMBEDDING'


class CapabilityRegistry:
    """
    Semantic Capability Registry for Industrial AI Operations.
    Defines capabilities, semantic descriptions for embedding matching,
    associated input modalities, target tools/models, and safety action classes.
    """
    CAPABILITIES: Dict[str, Dict[str, Any]] = {
        TaskType.OCR: {
            "name": "Optical Character Recognition & Text Extraction",
            "semantic_description": (
                "Optical character recognition, ocr scan, extract values from inspection sheet snapshot, photographs, "
                "transcribe handwritten notes, equipment rating plate inspection, and parse image documents."
            ),
            "modalities": ["image", "pdf", "scanned_pdf"],
            "tool_binding": "extract_ocr_text",
            "action_class": "INFORMATIONAL",
            "default_model_type": "OCR"
        },
        TaskType.DOCUMENT_ANALYSIS: {
            "name": "Document Understanding & Technical Analysis",
            "semantic_description": (
                "Summarize PDF document compliance checklist, analyze technical reports, maintenance logs, contract review, "
                "audit documentation, equipment specification tables, and document understanding."
            ),

            "modalities": ["pdf", "text", "document"],
            "tool_binding": "parse_document_pages",
            "action_class": "INFORMATIONAL",
            "default_model_type": "GENERAL_LLM"
        },
        TaskType.SOP_RAG: {
            "name": "Standard Operating Procedure & Manual Retrieval",
            "semantic_description": (
                "Search operating manuals, technical manuals, operating procedures, SOP instructions, "
                "section specifications, torque limits, lockout tagout LOTO instructions, regulatory standards, "
                "safety rules, and compliance criteria from plant maintenance SOP manuals."
            ),
            "modalities": ["text", "document"],
            "tool_binding": "run_rag_search",
            "action_class": "INFORMATIONAL",
            "default_model_type": "SOP_RAG"
        },

        TaskType.REASONING: {
            "name": "Industrial Diagnostic & Root Cause Reasoning",
            "semantic_description": (
                "Diagnose machine health status, equipment operational condition, industrial asset failure, "
                "compressor overheating, motor faults, root cause investigation, why equipment tripped, "
                "analyze multi-sensor telemetry, identify vibration anomalies, thermal excursions, bearing damage, "
                "cavitation, unbalance, component degradation, and troubleshooting."
            ),
            "modalities": ["text", "telemetry"],
            "tool_binding": "evaluate_safety_state",
            "action_class": "INFORMATIONAL",
            "default_model_type": "REASONING"
        },
        TaskType.GRAPH_RAG: {
            "name": "Knowledge Graph Causal Relationship Traversal",
            "semantic_description": (
                "Traverse plant asset ontology, upstream and downstream equipment connections, "
                "and historical failure incident chains to trace cascading fault propagation."
            ),
            "modalities": ["text"],
            "tool_binding": "query_knowledge_graph",
            "action_class": "INFORMATIONAL",
            "default_model_type": "REASONING"
        },
        TaskType.TELEMETRY_ANALYSIS: {
            "name": "Real-time Telemetry & Digital Twin Stream Inspection",
            "semantic_description": (
                "Query, inspect, and monitor machine health status, equipment operational condition, "
                "real-time sensor readings including temperature, vibration velocity, drive current draw, "
                "and gas concentrations from physical and digital twin assets."
            ),
            "modalities": ["text", "telemetry"],
            "tool_binding": "fetch_telemetry",
            "action_class": "INFORMATIONAL",
            "default_model_type": "REASONING"
        },
        TaskType.AGENT_PLANNER: {
            "name": "Autonomous Agent Step & Tool Decomposition",
            "semantic_description": (
                "Schedule technician workflow, equipment replacement, formulate automated maintenance plans, "
                "multi-step diagnostic plans, select tool sequences, coordinate inspections, schedule maintenance workflows, "
                "and synthesize engineering reports."
            ),
            "modalities": ["text"],
            "tool_binding": None,
            "action_class": "INFORMATIONAL",
            "default_model_type": "AGENT_PLANNER"
        },
        TaskType.CALCULATOR: {
            "name": "Deterministic Industrial Math & Engineering Equations",
            "semantic_description": (
                "Calculate and compute mathematical formulas, engineering equations, mechanical efficiency percentage, "
                "bearing defect frequency, remaining useful life L10, numerical evaluations, addition, subtraction, "
                "multiplication, division, arithmetic, plus, minus, times, simple math, addition of numbers, calculate 1+2, "
                "compute numbers, and math equations."
            ),
            "modalities": ["text"],
            "tool_binding": "calculate_engineering_formula",
            "action_class": "INFORMATIONAL",
            "default_model_type": "PYTHON_EXECUTION"
        },
        TaskType.PYTHON_EXECUTION: {
            "name": "Sandboxed Python Automation & Script Execution",
            "semantic_description": (
                "Execute sandboxed in-memory Python scripts for statistical analysis, tabular filtering, "
                "data transformation, perform python addition, python execution, code snippets, and deterministic validation."
            ),
            "modalities": ["text", "code"],
            "tool_binding": "execute_python_sandbox",
            "action_class": "INFORMATIONAL",
            "default_model_type": "CODE"
        },
        TaskType.CODE: {
            "name": "Industrial Code Generation & Automation Scripts",
            "semantic_description": (
                "Write Python scripts, python code, simple python addition, PLC logic, SCADA ladder logic, "
                "code snippets, programming, functions, and REST API integration functions."
            ),
            "modalities": ["code", "text"],
            "tool_binding": "execute_python_sandbox",
            "action_class": "INFORMATIONAL",
            "default_model_type": "CODE"
        },
        TaskType.VISION: {
            "name": "Industrial Computer Vision & Image Understanding",
            "semantic_description": (
                "Inspect engineering diagrams, P&ID schematics, physical damage photos, thermal camera images, "
                "and visual machine components."
            ),
            "modalities": ["image"],
            "tool_binding": "extract_ocr_text",
            "action_class": "INFORMATIONAL",
            "default_model_type": "OCR"
        },
        TaskType.SPREADSHEET: {
            "name": "Tabular Data & Spreadsheet Processing",
            "semantic_description": (
                "Parse tabular data, filter rows, compute spreadsheet columns, Excel XLSX files, "
                "CSV tables, and component spare parts inventories."
            ),
            "modalities": ["csv", "spreadsheet"],
            "tool_binding": "execute_python_sandbox",
            "action_class": "INFORMATIONAL",
            "default_model_type": "CODE"
        },
        TaskType.PDF_PROCESSING: {
            "name": "PDF Document Ingestion & Page Splitting",
            "semantic_description": (
                "Render, extract pages, split chapters, and index PDF manuals and equipment spec sheets."
            ),
            "modalities": ["pdf"],
            "tool_binding": "parse_document_pages",
            "action_class": "INFORMATIONAL",
            "default_model_type": "GENERAL_LLM"
        },
        TaskType.GENERAL_LLM: {
            "name": "General Industrial Assistant & Architecture Guidance",
            "semantic_description": (
                "General assistant help, please help me, can you assist, who are you, what can you do, "
                "hello system, general assistant guidance, explain core capabilities, conversational answers, "
                "general questions, everyday queries, quick answer, simple questions, explain concepts, "
                "general engineering questions, and greeting operators."
            ),
            "modalities": ["text"],
            "tool_binding": None,
            "action_class": "INFORMATIONAL",
            "default_model_type": "GENERAL_LLM"
        },
        TaskType.EMBEDDING: {
            "name": "Vector Embedding & Semantic Indexing",
            "semantic_description": (
                "Compute dense mathematical vector embedding for semantic search and document index vectorization."
            ),
            "modalities": ["text"],
            "tool_binding": None,
            "action_class": "INFORMATIONAL",
            "default_model_type": "EMBEDDING"
        }

    }

    _EMBEDDING_CACHE: Dict[str, List[float]] = {}

    @classmethod
    def get_capability_embeddings(cls) -> Dict[str, List[float]]:
        if not cls._EMBEDDING_CACHE:
            for cap_name, info in cls.CAPABILITIES.items():
                cls._EMBEDDING_CACHE[cap_name] = LocalEmbeddingEngine.embed_text(
                    f"{info['name']}. {info['semantic_description']}"
                )
        return cls._EMBEDDING_CACHE

    @classmethod
    def get_capability(cls, cap_id: str) -> Optional[Dict[str, Any]]:
        return cls.CAPABILITIES.get(cap_id)

    @classmethod
    def list_capabilities(cls) -> List[Dict[str, Any]]:
        result = []
        for cap_id, info in cls.CAPABILITIES.items():
            result.append({
                "id": cap_id,
                "name": info["name"],
                "type": info["action_class"],
                "description": info["semantic_description"],
                "is_controlled": info["action_class"] == "CONTROLLED",
                "examples": info.get("modalities", [])
            })
        return result



class TaskClassifier:
    """
    True Semantic Task Classifier and Capability Matcher.
    Uses dense vector embeddings, capability registry cosine similarity,
    and workflow decomposition rather than brittle keyword matching.
    """

    VALID_TASKS = set(CapabilityRegistry.CAPABILITIES.keys())

    # Fallback keyword indicators (used only if embeddings are unavailable or secondary signal)
    TASK_INDICATORS = {
        TaskType.SOP_RAG: [
            'sop-', 'sop ', 'procedure', 'manual', 'specification', 'spec ',
            'compliance', 'iso 10816', 'torque', 'loto', 'guideline',
            'regulation', 'standard operating procedure', 'maintenance protocol'
        ],
        TaskType.AGENT_PLANNER: [
            'plan', 'execute', 'steps', 'workflow', 'action sequence',
            'schedule', 'remediate', 'interlock sequence', 'take action'
        ],
        TaskType.OCR: [
            'ocr', 'extract text', 'scanned', 'transcribe', 'nameplate',
            'inspection sheet', 'handwritten', 'parse image', 'read document'
        ],
        TaskType.REASONING: [
            'vibration', 'temperature', 'temp ', 'pressure', 'current',
            'anomaly', 'failure', 'bearing', 'spindle', 'root cause',
            'diagnostic', 'excursion', 'cavitation', 'spalling', 'degradation',
            'wear', 'acoustic', 'unbalance', 'health score', 'machine-00', 'pump-00',
            'motor-00', 'compressor-00'
        ],
        TaskType.DOCUMENT_ANALYSIS: [
            'summarize pdf', 'summarize document', 'document compliance', 'parse document',
            'contract', 'audit report', 'page summary', 'technical manual'
        ],
        TaskType.CALCULATOR: [
            'calculate', 'efficiency', 'formula', 'flow rate', 'rpm', 'math', 'compute power'
        ],
        TaskType.GRAPH_RAG: [
            'upstream', 'downstream', 'causal chain', 'root cause chain', 'component failure'
        ],
        TaskType.EMBEDDING: [
            'vector embedding', 'compute embedding', 'semantic index', 'embed text'
        ]
    }

    @classmethod
    def classify(
        cls,
        prompt: str,
        explicit_task: Optional[str] = None,
        has_machine: bool = False,
        has_rag_context: bool = False,
        has_graph_facts: bool = False,
        input_modality: str = "text"
    ) -> Dict[str, Any]:
        """
        Classifies user prompt using dense semantic embedding similarity against
        registered capability descriptions. Detects multi-task workflows and returns
        confidence and ranked alternatives.
        """
        # 1. Respect explicit task override if provided and valid
        if explicit_task and explicit_task.upper() in cls.VALID_TASKS:
            return {
                'task_type': explicit_task.upper(),
                'confidence': 1.0,
                'method': 'EXPLICIT_OVERRIDE',
                'matched_indicators': [],
                'is_multitask': False,
                'workflow_tasks': [explicit_task.upper()],
                'ranked_capabilities': [{'task': explicit_task.upper(), 'score': 1.0}],
                'is_ambiguous': False
            }

        cleaned = prompt.strip()
        if not cleaned:
            return {
                'task_type': TaskType.GENERAL_LLM,
                'confidence': 0.5,
                'method': 'DEFAULT_EMPTY',
                'matched_indicators': [],
                'is_multitask': False,
                'workflow_tasks': [TaskType.GENERAL_LLM],
                'ranked_capabilities': [],
                'is_ambiguous': True
            }

        # 2. Level 1: Dense Semantic Embedding Similarity Matching
        try:
            query_vec = LocalEmbeddingEngine.embed_text(cleaned)
            cap_embeddings = CapabilityRegistry.get_capability_embeddings()

            scores: List[Tuple[str, float]] = []
            for cap_name, cap_vec in cap_embeddings.items():
                sim = LocalEmbeddingEngine.cosine_similarity(query_vec, cap_vec)
                # Modality bonus
                cap_info = CapabilityRegistry.CAPABILITIES[cap_name]
                if input_modality in cap_info["modalities"]:
                    sim += 0.08
                if has_machine and cap_name in [TaskType.REASONING, TaskType.TELEMETRY_ANALYSIS]:
                    sim += 0.06
                if has_rag_context and cap_name == TaskType.SOP_RAG:
                    sim += 0.06
                if has_graph_facts and cap_name == TaskType.GRAPH_RAG:
                    sim += 0.06

                scores.append((cap_name, round(float(sim), 3)))

            lower_clean = cleaned.lower()

            # Detect code/scripting keywords (including common typos like pyhthon, pyton, etc.)
            has_code_intent = bool(re.search(r'\b(code|py[ht]+on|script|function|program|algorithm|ladder logic|rest api|write a|def |print\(|code snippet)\b', lower_clean))
            # Detect math/arithmetic keywords and expressions (e.g. 1+2, addition of, calculate)
            has_math_intent = bool(re.search(r'(\d+\s*[\+\-\*\/\^%]\s*\d+|\b(addition|subtract|multiply|divide|calculate|math|compute formula|sum of|equals)\b)', lower_clean))
            # Detect general conceptual / comparative explanations
            is_general_explanation = any(q in lower_clean for q in ['what is', 'what are', 'explain how', 'how does', 'difference between', 'compare', 'principles of', 'who are you', 'help me'])

            # Detect equipment or machine mention in query
            has_equipment_mention = any(k in lower_clean for k in [
                'machine', 'compressor', 'pump', 'motor', 'spindle', 'bearing', 'boiler',
                'turbine', 'cnc', 'valve', 'chiller', 'asset', 'equipment', 'actuator', 'gearbox'
            ]) or has_machine

            # Detect telemetry/sensor metrics
            has_sensor_metrics = any(k in lower_clean for k in [
                'telemetry', 'sensor', 'reading', 'vibration', 'temperature', 'temp ', 'pressure',
                'current draw', 'motor current', 'rpm', 'voltage', 'flow rate', 'anomaly', 'bearing wear',
                'overheat', 'trip', 'fault', 'psi', 'bar', 'khz', 'hz', 'decibel'
            ])

            # Detect telemetry/sensor/equipment keywords (only for active diagnostics, not conceptual explanations)
            has_telemetry_intent = (not is_general_explanation) and (
                has_sensor_metrics or (has_equipment_mention and any(k in lower_clean for k in ['vibrate', 'vibration', 'heat', 'hot', 'overheat', 'failing', 'status', 'health', 'sensor', 'reading']))
            )

            # Detect graph / ontology cues
            has_graph_intent = any(k in lower_clean for k in ['upstream', 'downstream', 'causal', 'ontology', 'knowledge graph', 'failure chain', 'root cause chain']) or has_graph_facts

            # Detect reasoning / root cause intent
            has_reasoning_intent = any(q in lower_clean for q in ['why did', 'why is', 'root cause', 'diagnose', 'investigate', 'failure cause', 'troubleshoot'])

            # 1. Penalize GRAPH_RAG if prompt does NOT contain graph/causal keywords
            if not has_graph_intent:
                for i, (cap, sc) in enumerate(scores):
                    if cap == TaskType.GRAPH_RAG:
                        scores[i] = (cap, round(sc * 0.10, 3))

            # 2. Penalize TELEMETRY_ANALYSIS if prompt is not diagnostic telemetry
            if not (has_telemetry_intent or has_sensor_metrics):
                for i, (cap, sc) in enumerate(scores):
                    if cap == TaskType.TELEMETRY_ANALYSIS:
                        scores[i] = (cap, round(sc * 0.15, 3))

            # 3. Boost CODE / PYTHON_EXECUTION when code intent is present
            if has_code_intent:
                for i, (cap, sc) in enumerate(scores):
                    if cap in [TaskType.CODE, TaskType.PYTHON_EXECUTION]:
                        scores[i] = (cap, round(sc + 0.40, 3))
            else:
                for i, (cap, sc) in enumerate(scores):
                    if cap in [TaskType.CODE, TaskType.PYTHON_EXECUTION]:
                        scores[i] = (cap, round(sc * 0.25, 3))

            # 4. Boost CALCULATOR when math or formula intent is present
            has_calc_intent = has_math_intent or any(q in lower_clean for q in ['remaining useful life', 'rul', 'compute formula', 'calculate life', 'stress formula'])
            if has_calc_intent and not has_code_intent:
                for i, (cap, sc) in enumerate(scores):
                    if cap == TaskType.CALCULATOR:
                        scores[i] = (cap, round(sc + 0.35, 3))
                    elif cap == TaskType.GENERAL_LLM:
                        scores[i] = (cap, round(sc + 0.15, 3))

            # 5. If user asks conceptual / comparative questions or general help, boost GENERAL_LLM
            if is_general_explanation and not has_code_intent and not has_math_intent:
                for i, (cap, sc) in enumerate(scores):
                    if cap == TaskType.GENERAL_LLM:
                        scores[i] = (cap, round(sc + 0.45, 3))
                        break

            # 6. If user asks causal/diagnostic questions on machinery or telemetry, boost REASONING
            if (has_telemetry_intent or has_equipment_mention or has_reasoning_intent) and (has_reasoning_intent or 'overheat' in lower_clean):
                for i, (cap, sc) in enumerate(scores):
                    if cap == TaskType.REASONING:
                        scores[i] = (cap, round(sc + 0.35, 3))
                        break

            # 7. If user asks about machine health or telemetry, boost TELEMETRY_ANALYSIS
            if has_telemetry_intent and any(q in lower_clean for q in ['health', 'status', 'condition', 'vibration', 'temperature', 'telemetry', 'sensor', 'reading', 'diagnose', 'anomaly']):
                for i, (cap, sc) in enumerate(scores):
                    if cap == TaskType.TELEMETRY_ANALYSIS:
                        scores[i] = (cap, round(sc + 0.30, 3))
                    elif cap == TaskType.REASONING:
                        scores[i] = (cap, round(sc + 0.25, 3))

            scores.sort(key=lambda x: x[1], reverse=True)
            top_task, top_score = scores[0]

            # If top score is low and no specialized intent is present, default to GENERAL_LLM
            if top_score < 0.38 and not has_telemetry_intent and not has_code_intent and not has_math_intent and not has_graph_intent and not has_reasoning_intent and not has_equipment_mention:
                top_task = TaskType.GENERAL_LLM
                top_score = 0.50


            # 3. Detect Multi-Step Workflow Intent
            # Checks if query requests a sequence of operations
            workflow_tasks = cls._detect_workflow_sequence(cleaned, scores, input_modality)
            is_multitask = len(workflow_tasks) > 1

            # Ambiguity check: very short query with low semantic certainty
            is_ambiguous = (len(cleaned.split()) <= 2) and (top_score < 0.40)

            return {
                'task_type': top_task,
                'confidence': min(0.98, max(0.40, top_score)),
                'method': 'SEMANTIC_EMBEDDING_MATCH',
                'matched_indicators': [f"semantic_score={top_score}"],
                'is_multitask': is_multitask,
                'workflow_tasks': workflow_tasks,
                'workflow_sequence': workflow_tasks,
                'ranked_capabilities': [{'task': t, 'score': s} for t, s in scores[:5]],
                'is_ambiguous': is_ambiguous
            }


        except Exception as e:
            # 4. Level 3: Deterministic Heuristic Fallback if embeddings fail
            return cls._deterministic_fallback(cleaned, has_machine, has_rag_context, has_graph_facts)

    @classmethod
    def _detect_workflow_sequence(
        cls,
        prompt: str,
        ranked_scores: List[Tuple[str, float]],
        input_modality: str
    ) -> List[str]:
        """
        Decomposes compound user requests into ordered multi-step workflows.
        Example: "Extract text from these pages and then explain the maintenance procedure"
        -> [OCR, DOCUMENT_ANALYSIS, SOP_RAG, GENERAL_LLM]
        """
        lower = prompt.lower()
        tasks: List[str] = []

        # Sequential connector cues
        has_and_then = any(c in lower for c in ["and then", "then ", "after that", "and explain", "and determine", "and check", "compare against"])
        is_scanned_doc = any(w in lower for w in ["scanned", "ocr", "read document", "read this report", "extract the text", "read all the information", "inspection sheet"]) or input_modality in ["image", "pdf"]
        has_sop_intent = any(w in lower for w in ["sop", "manual", "procedure", "specification", "criteria", "standard"])
        has_diagnostic_intent = any(w in lower for w in ["bearing", "failing", "vibration", "overheat", "failure", "temperature", "anomaly", "diagnose"])
        has_calc_intent = any(w in lower for w in ["calculate", "efficiency", "formula", "flow rate", "power"])

        # Construct logical multi-step sequence
        if is_scanned_doc:
            tasks.append(TaskType.OCR)
            tasks.append(TaskType.DOCUMENT_ANALYSIS)

        if has_sop_intent:
            tasks.append(TaskType.SOP_RAG)

        if has_diagnostic_intent:
            tasks.append(TaskType.REASONING)

        if has_calc_intent:
            tasks.append(TaskType.CALCULATOR)

        # Fallback to single top task if no composite workflow detected
        if not tasks:
            top_task = ranked_scores[0][0]
            tasks = [top_task]

        # Deduplicate while preserving order
        ordered_tasks = []
        for t in tasks:
            if t not in ordered_tasks:
                ordered_tasks.append(t)

        return ordered_tasks

    @classmethod
    def _deterministic_fallback(
        cls,
        prompt: str,
        has_machine: bool,
        has_rag_context: bool,
        has_graph_facts: bool
    ) -> Dict[str, Any]:
        """Deterministic keyword-based fallback if vector embeddings fail."""
        cleaned = prompt.lower()
        matched: Dict[str, List[str]] = {t: [] for t in cls.TASK_INDICATORS}

        for task, keywords in cls.TASK_INDICATORS.items():
            for kw in keywords:
                if kw in cleaned:
                    matched[task].append(kw)

        if matched[TaskType.OCR]:
            resolved = TaskType.OCR
        elif matched[TaskType.DOCUMENT_ANALYSIS]:
            resolved = TaskType.DOCUMENT_ANALYSIS
        elif matched[TaskType.CALCULATOR]:
            resolved = TaskType.CALCULATOR
        elif matched[TaskType.GRAPH_RAG] or has_graph_facts:
            resolved = TaskType.GRAPH_RAG
        elif matched[TaskType.SOP_RAG] or has_rag_context:
            resolved = TaskType.SOP_RAG
        elif matched[TaskType.AGENT_PLANNER]:
            resolved = TaskType.AGENT_PLANNER
        elif matched[TaskType.REASONING] or has_machine:
            resolved = TaskType.REASONING
        else:
            resolved = TaskType.GENERAL_LLM

        return {
            'task_type': resolved,
            'confidence': 0.75,
            'method': 'DETERMINISTIC_FALLBACK',
            'matched_indicators': matched.get(resolved, []),
            'is_multitask': False,
            'workflow_tasks': [resolved],
            'ranked_capabilities': [{'task': resolved, 'score': 0.75}],
            'is_ambiguous': False
        }

