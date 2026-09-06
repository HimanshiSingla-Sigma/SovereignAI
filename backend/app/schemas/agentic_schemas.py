from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class TaskItem(BaseModel):
    task_id: str = Field(description="Unique string identifier for this step, e.g. '1', '2'")
    agent_type: str = Field(description="Target agent: 'TELEMETRY', 'RAG', 'VISION_OCR', 'REASONING', 'SAFETY_CONTROL', 'CODE'")
    objective: str = Field(description="Concrete goal and action to perform for this step")
    reason: str = Field(description="Explanation of why this task is needed to answer the user query")
    dependencies: List[str] = Field(default_factory=list, description="List of task_ids that must complete before this step")
    target_resource: Optional[str] = Field(default=None, description="Target machine or document name, e.g. 'Machine-001', 'Machine-002', 'SOP-MNT-042.txt'")
    input_parameters: Dict[str, Any] = Field(default_factory=dict, description="Operational parameters for the tool/agent")

class TaskPlan(BaseModel):
    intent: str = Field(description="High-level operational intent of the user request (e.g. 'TELEMETRY_DIAGNOSTICS', 'SOP_QUERY', 'EMERGENCY_SHUTDOWN', 'GENERAL_ASSISTANCE')")
    reasoning: str = Field(description="High-level architectural reasoning explaining why these steps were chosen")
    tasks: List[TaskItem] = Field(description="Ordered list of actionable tasks to execute")
    requires_human_approval: bool = Field(default=False, description="True if any task commands physical actuators, valve overrides, or machine shutdown")

class AgentExecutionResult(BaseModel):
    agent_type: str
    status: str = "COMPLETED"  # "COMPLETED", "FAILED", "WAITING_APPROVAL"
    output_summary: str
    data: Dict[str, Any] = Field(default_factory=dict)
    execution_time_ms: float = 0.0
    error: Optional[str] = None

class ReplanningDecision(BaseModel):
    should_retry: bool = Field(description="Whether to retry the failed task or replace it")
    revised_objective: str = Field(description="Updated objective or alternative strategy")
    alternative_agent: Optional[str] = Field(default=None, description="Alternative agent to use if current agent failed")
    reason: str = Field(description="Explanation for the replanning decision")
