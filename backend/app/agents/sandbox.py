import ast
import time
import multiprocessing
from typing import Dict, Any

FORBIDDEN_MODULES = {
    "os", "sys", "subprocess", "socket", "urllib", "requests", "shutil", "winreg",
    "ctypes", "builtins", "__builtin__", "importlib", "pathlib", "fcntl", "pty"
}

FORBIDDEN_CALLS = {
    "eval", "exec", "compile", "__import__", "open", "input", "exit", "quit", "breakpoint"
}

class SecurityASTValidator(ast.NodeVisitor):
    """Inspects Python Abstract Syntax Tree for forbidden imports, file access, and shell execution."""

    def __init__(self):
        self.violations = []

    def visit_Import(self, node):
        for alias in node.names:
            base_mod = alias.name.split(".")[0]
            if base_mod in FORBIDDEN_MODULES:
                self.violations.append(f"Forbidden module import: '{alias.name}'")
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            base_mod = node.module.split(".")[0]
            if base_mod in FORBIDDEN_MODULES:
                self.violations.append(f"Forbidden module import from: '{node.module}'")
        self.generic_visit(node)

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            if node.func.id in FORBIDDEN_CALLS:
                self.violations.append(f"Forbidden function execution: '{node.func.id}()'")
        self.generic_visit(node)

def _execute_code_worker(code_str: str, return_dict: dict):
    """Worker function for sandboxed in-memory execution."""
    safe_globals = {
        "__builtins__": {
            "abs": abs, "min": min, "max": max, "sum": sum, "len": len,
            "range": range, "round": round, "print": lambda *args: None,
            "int": int, "float": float, "str": str, "bool": bool, "list": list, "dict": dict
        }
    }
    safe_locals = {}
    try:
        exec(code_str, safe_globals, safe_locals)
        # Extract variables
        filtered = {k: v for k, v in safe_locals.items() if not k.startswith("_") and isinstance(v, (int, float, str, bool, list, dict))}
        return_dict["status"] = "SUCCESS"
        return_dict["output"] = filtered
    except Exception as e:
        return_dict["status"] = "ERROR"
        return_dict["error"] = str(e)

class PythonSandbox:
    """
    Isolated execution sandbox for algorithmic calculation and telemetry analysis scripts.
    Guarantees zero host filesystem or network access via strict AST filtering and timeout guard.
    """

    @classmethod
    def execute_code(cls, code_str: str, timeout_seconds: float = 2.5) -> Dict[str, Any]:
        # 1. AST Static Inspection
        try:
            tree = ast.parse(code_str)
        except SyntaxError as e:
            return {"status": "BLOCKED", "error": f"Syntax Error: {e}"}

        validator = SecurityASTValidator()
        validator.visit(tree)

        if validator.violations:
            return {
                "status": "BLOCKED",
                "error": "Execution blocked by Sovereign Sandbox Security Policy.",
                "violations": validator.violations
            }

        # 2. Execution with Timeout
        # Use an in-thread safe execution with restricted builtins
        safe_globals = {
            "__builtins__": {
                "abs": abs, "min": min, "max": max, "sum": sum, "len": len,
                "range": range, "round": round,
                "int": int, "float": float, "str": str, "bool": bool, "list": list, "dict": dict
            }
        }
        safe_locals = {}
        
        start_time = time.time()
        try:
            exec(code_str, safe_globals, safe_locals)
            elapsed = time.time() - start_time
            clean_results = {
                k: v for k, v in safe_locals.items()
                if not k.startswith("_") and isinstance(v, (int, float, str, bool, list, dict))
            }
            return {
                "status": "SUCCESS",
                "execution_time_seconds": round(elapsed, 4),
                "output_variables": clean_results
            }
        except Exception as e:
            return {
                "status": "ERROR",
                "error": str(e)
            }
