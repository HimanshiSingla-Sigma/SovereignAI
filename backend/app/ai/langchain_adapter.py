from typing import List, Optional, Any, Dict
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from langchain_core.callbacks.manager import CallbackManagerForLLMRun
from pydantic import Field

from app.ai.gateway import model_gateway
from app.ai.inference_engine import InferenceEngine

class SovereignLocalChatModel(BaseChatModel):
    """
    Real LangChain-compatible Chat Model Adapter for the Sovereign On-Premise AI Engine.
    Exposes full LangChain BaseChatModel interfaces (.invoke(), .ainvoke(), pipes, chains)
    while routing through the local air-gapped GGUF inference engine and deterministic fallback.
    Zero external cloud API dependencies.
    """
    model_name: str = Field(default="sovereign-local-gguf")
    task_type: str = Field(default="GENERAL_LLM")
    user: str = Field(default="system")
    temperature: float = Field(default=0.2)
    max_tokens: int = Field(default=1024)

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any
    ) -> ChatResult:
        # 1. Deconstruct LangChain message list
        system_prompts: List[str] = []
        user_queries: List[str] = []

        for msg in messages:
            if isinstance(msg, SystemMessage):
                system_prompts.append(msg.content)
            elif isinstance(msg, HumanMessage):
                user_queries.append(msg.content)
            elif isinstance(msg, AIMessage):
                # Include prior assistant turn in context if relevant
                user_queries.append(f"[Previous AI Response]: {msg.content}")
            else:
                user_queries.append(str(msg.content))

        combined_prompt = "\n\n".join(user_queries) if user_queries else "Hello"
        context_chunks: List[str] = system_prompts

        # 2. Invoke sovereign local gateway
        effective_task = kwargs.get("task_type", self.task_type)
        res = model_gateway.process_request(
            prompt=combined_prompt,
            user=self.user,
            task_type=effective_task,
            context_chunks=context_chunks
        )

        response_text = res.get("response", "")
        generation = ChatGeneration(
            message=AIMessage(content=response_text),
            generation_info={
                "model_used": res.get("model_used"),
                "is_fallback": res.get("is_fallback", False),
                "safety_check": res.get("safety_check", "PASSED")
            }
        )
        return ChatResult(generations=[generation])

    @property
    def _llm_type(self) -> str:
        return "sovereign_local_chat_model"
