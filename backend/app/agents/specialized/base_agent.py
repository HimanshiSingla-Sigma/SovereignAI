from abc import ABC, abstractmethod
from typing import Dict, Any
from app.schemas.agentic_schemas import TaskItem, AgentExecutionResult
from app.agents.graph_state import OrchestratorGraphState

class BaseAgent(ABC):
    """
    Abstract Base Agent Contract for all Sovereign Specialized Agents.
    Every specialized agent has:
    - A concrete domain responsibility
    - Strict input parameters via TaskItem
    - Standardized output schema via AgentExecutionResult
    - Audit and error handling
    """

    @property
    @abstractmethod
    def agent_type(self) -> str:
        pass

    @abstractmethod
    def execute(self, task: TaskItem, state: OrchestratorGraphState) -> AgentExecutionResult:
        pass
