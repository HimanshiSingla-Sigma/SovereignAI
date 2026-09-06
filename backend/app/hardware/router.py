from typing import Dict, List, Any, Optional
from app.hardware.profile import HardwareProfile, HardwareTier
from app.hardware.registry import ModelRegistry
from app.core.config import settings

class CandidateEvaluation(dict):
    """Candidate evaluation supporting both dict indexing and attribute access."""
    def __getattr__(self, item):
        try:
            return self[item]
        except KeyError:
            raise AttributeError(f"'CandidateEvaluation' has no attribute '{item}'")

class ModelRoutingDecision(dict):
    """Routing decision supporting both dict indexing and attribute access."""
    def __getattr__(self, item):
        try:
            return self[item]
        except KeyError:
            raise AttributeError(f"'ModelRoutingDecision' has no attribute '{item}'")

class HardwareAwareRouter:
    """
    Deterministic Hardware-Aware Multi-Model Routing Engine.
    Evaluates runtime hardware limits (RAM, VRAM, CPU cores, GPU acceleration),
    applies configurable safety margins, scores candidates based on capability,
    headroom, and task affinity, and outputs explainable routing decisions.
    """

    @classmethod
    def route_task(
        cls,
        task_type: str = 'GENERAL_LLM',
        task: Optional[str] = None,
        prompt: Optional[str] = None,
        profile: Optional[HardwareProfile] = None,
        hw_profile: Optional[HardwareProfile] = None,
        available_models: Optional[List[Dict[str, Any]]] = None
    ) -> ModelRoutingDecision:
        effective_task = task or task_type
        effective_hw = hw_profile or profile or HardwareProfile()
        models = available_models if available_models is not None else ModelRegistry.get_available_models()

        summary = effective_hw.get_summary()
        max_safe_ram = effective_hw.max_model_ram_gb
        max_safe_vram = effective_hw.max_model_vram_gb
        has_gpu = summary.get('has_dedicated_gpu', False)

        evaluated_candidates: List[CandidateEvaluation] = []
        feasible_candidates: List[Dict[str, Any]] = []

        for m in models:
            m_id = m.get('model_id')
            m_name = m.get('name')
            supported_tasks = m.get('supported_tasks', [m.get('model_type')])
            ram_req = m.get('ram_required_gb', 1.0)
            vram_req = m.get('vram_required_gb', 0.0)
            is_fallback = m.get('is_fallback', False)

            # 1. Task Capability Check
            task_match = (effective_task in supported_tasks) or (effective_task == 'ANY') or is_fallback
            if not task_match:
                evaluated_candidates.append(CandidateEvaluation({
                    'model_id': m_id,
                    'name': m_name,
                    'status': 'REJECTED_TASK',
                    'is_feasible': False,
                    'score': 0.0,
                    'execution_mode': 'none',
                    'target_hardware': 'none',
                    'reason': f'Model does not support task {effective_task}. Supported: {supported_tasks}',
                    'ram_required_gb': ram_req,
                    'vram_required_gb': vram_req
                }))
                continue

            # 2. Hardware Feasibility Check
            # Check GPU offload eligibility
            gpu_eligible = has_gpu and (vram_req > 0.0) and (vram_req <= max_safe_vram)
            # Check CPU memory eligibility
            cpu_eligible = (ram_req <= max_safe_ram) and m.get('cpu_compatible', True)

            if gpu_eligible:
                exec_mode = 'cuda'
                is_feasible = True
                target = 'GPU (CUDA)'
            elif cpu_eligible or is_fallback:
                exec_mode = 'llama_cpp' if not is_fallback else 'native'
                is_feasible = True
                target = 'CPU (llama.cpp)' if not is_fallback else 'CPU (Native In-Memory)'
            else:
                exec_mode = 'none'
                is_feasible = False
                target = 'none'
                rejection_msg = (
                    f'Insufficient resources: Requires {ram_req} GB RAM (safe budget: {max_safe_ram} GB); '
                    f'GPU VRAM budget: {max_safe_vram} GB (required: {vram_req} GB).'
                )
                evaluated_candidates.append(CandidateEvaluation({
                    'model_id': m_id,
                    'name': m_name,
                    'status': 'REJECTED_MEMORY',
                    'is_feasible': False,
                    'score': 0.0,
                    'execution_mode': 'none',
                    'target_hardware': 'none',
                    'reason': rejection_msg,
                    'ram_required_gb': ram_req,
                    'vram_required_gb': vram_req
                }))
                continue

            # 3. Scoring Function (Multi-Factor Optimization)
            # Balances: Model Quality/Capacity + Task Affinity + Memory Headroom + Hardware Efficiency
            score = 50.0

            # Task Affinity
            if m.get('model_type') == effective_task:
                score += 25.0  # Primary specialization match
            elif effective_task in supported_tasks:
                score += 12.0  # Secondary support

            # Model Quality/Capacity factor (reward larger capable models that fit safely)
            params_b = m.get('parameters_b', 0.5)
            score += min(25.0, params_b * 7.5)

            # Headroom Factor
            if 'CPU' in target:
                headroom_gb = max(0.0, max_safe_ram - ram_req)
                headroom_ratio = headroom_gb / max(1.0, max_safe_ram)
                score += min(15.0, headroom_ratio * 15.0)
            else:
                headroom_gb = max(0.0, max_safe_vram - vram_req)
                score += 20.0  # Dedicated GPU acceleration boost

            # Priority modifier
            score += m.get('priority', 50) * 0.08

            # Native Fallback penalty so any compatible GGUF model takes precedence
            if is_fallback:
                score = 15.0

            candidate_eval = CandidateEvaluation({
                'model_id': m_id,
                'name': m_name,
                'status': 'COMPATIBLE',
                'is_feasible': True,
                'score': round(score, 1),
                'execution_mode': exec_mode,
                'target_hardware': target,
                'ram_required_gb': ram_req,
                'vram_required_gb': vram_req,
                'is_fallback': is_fallback,
                'model_data': m,
                'reason': f'Compatible on {target} with score {round(score, 1)}/100.'
            })
            evaluated_candidates.append(candidate_eval)
            feasible_candidates.append(candidate_eval)

        # 4. Final Decision
        # Sort feasible candidates by score descending
        feasible_candidates.sort(key=lambda x: x['score'], reverse=True)

        # Filter out fallback if a real GGUF model is feasible
        gguf_candidates = [c for c in feasible_candidates if not c['is_fallback']]
        if gguf_candidates:
            chosen = gguf_candidates[0]
            for c in evaluated_candidates:
                if c['model_id'] == chosen['model_id']:
                    c['status'] = 'SELECTED'
        elif feasible_candidates:
            chosen = feasible_candidates[0]
            for c in evaluated_candidates:
                if c['model_id'] == chosen['model_id']:
                    c['status'] = 'SELECTED'
        else:
            # Ultimate safety net: Native Fallback
            fallback_model = ModelRegistry.NATIVE_FALLBACK
            chosen = CandidateEvaluation({
                'model_id': fallback_model['model_id'],
                'name': fallback_model['name'],
                'status': 'SELECTED',
                'is_feasible': True,
                'score': 15.0,
                'execution_mode': 'native',
                'target_hardware': 'CPU (Native In-Memory)',
                'ram_required_gb': 0.4,
                'vram_required_gb': 0.0,
                'is_fallback': True,
                'model_data': fallback_model,
                'reason': 'Zero compatible GGUF models on disk. Falling back to in-process deterministic reasoner.'
            })

        # 5. Formulate Structured Human-Readable Explainability
        decision_reasons = []
        if chosen['is_fallback']:
            decision_reasons.append(
                'Level-4 Native Fallback: No locally installed GGUF models were detected or hardware memory limits exceeded.'
            )
            decision_reasons.append(
                'Safely selected Sovereign Native Deterministic Reasoner (0 MB disk, 0.4 GB RAM, zero cloud dependencies).'
            )
            decision_reasons.append(
                'Preserves deterministic threshold checks (95°C, 4.5 mm/s, 18 bar, 25 ppm) and SOP grounding.'
            )
        else:
            sel_data = chosen['model_data']
            decision_reasons.append(
                f'Task requirement "{effective_task}" matched model capability ({sel_data.get("parameters", "N/A")} parameters, {sel_data.get("quantization", "Q4_K_M")}).'
            )
            if 'GPU' in chosen['target_hardware']:
                decision_reasons.append(
                    f'GPU acceleration selected ({summary.get("gpu_name")}, {chosen["vram_required_gb"]} GB VRAM required within safe {max_safe_vram} GB budget).'
                )
            else:
                decision_reasons.append(
                    f'CPU execution selected ({chosen["ram_required_gb"]} GB RAM required within safe {max_safe_ram} GB memory budget).'
                )
            decision_reasons.append(
                f'Evaluated {len(evaluated_candidates)} candidate models. Selected model achieved top score ({chosen["score"]}/100).'
            )

        selected_model_info = chosen.get('model_data') or ModelRegistry.get_by_id(chosen['model_id'])

        return ModelRoutingDecision({
            'selected_model_id': chosen['model_id'],
            'selected_model_name': chosen['name'],
            'selected_model': selected_model_info,
            'task': effective_task,
            'execution_mode': chosen['execution_mode'],
            'target_hardware': chosen.get('target_hardware', 'CPU'),
            'is_fallback': chosen['is_fallback'],
            'score': chosen['score'],
            'reasons': decision_reasons,
            'hardware_snapshot': {
                'cpu_model': summary['cpu_model'],
                'logical_cores': summary['logical_cores'],
                'available_threads': summary.get('available_threads', 4),
                'total_ram_gb': summary['total_ram_gb'],
                'available_ram_gb': summary['available_ram_gb'],
                'gpu_name': summary['gpu_name'],
                'has_dedicated_gpu': summary['has_dedicated_gpu'],
                'acceleration': summary['acceleration'],
                'tier': summary['tier']
            },
            'resource_budget': {
                'max_safe_ram_gb': max_safe_ram,
                'max_safe_vram_gb': max_safe_vram,
                'model_ram_required_gb': chosen['ram_required_gb'],
                'model_vram_required_gb': chosen['vram_required_gb'],
                'ram_safety_headroom_gb': round(max(0.0, max_safe_ram - chosen['ram_required_gb']), 2),
                'max_ram_utilization_limit': getattr(settings, 'MODEL_MAX_RAM_UTILIZATION', 0.70)
            },
            'candidates_evaluated': evaluated_candidates
        })

    @classmethod
    def get_full_routing_table(cls, profile: Optional[HardwareProfile] = None) -> Dict[str, Any]:
        """
        Returns current routing decisions across all standard tasks for administrative visibility.
        """
        hw = profile or HardwareProfile()
        tasks = ['GENERAL_LLM', 'REASONING', 'AGENT_PLANNER', 'SOP_RAG', 'OCR']
        table = {}
        for t in tasks:
            table[t] = cls.route_task(task_type=t, profile=hw)

        return {
            'hardware_summary': hw.get_summary(),
            'routing_table': table
        }
