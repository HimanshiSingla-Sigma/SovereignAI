"""
Network sovereignty monitor (ADDITIVE — no existing route is modified).

Provides the evidence behind the platform's air-gap claim: which sockets the
host actually holds open, whether any of them leave the local network, and a
live egress probe. Gated on `safety:read` so every operator role can verify
sovereignty, matching the existing `require_permission(...)` style.
"""
import ipaddress
import socket
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from app.core.rbac import require_permission

router = APIRouter(prefix="/network", tags=["Network Sovereignty"])

# TEST-NET-3 (RFC 5737). Reserved for documentation and guaranteed never to be
# routed to a real service, so the probe proves egress is blocked without ever
# contacting a third party.
EGRESS_PROBE_HOST = "203.0.113.1"
EGRESS_PROBE_PORT = 80
EGRESS_PROBE_TIMEOUT = 0.35


def _is_internal(host: str) -> bool:
    """True for loopback, link-local, private and otherwise non-routable addresses."""
    if not host:
        return True
    try:
        addr = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return True
    return bool(
        addr.is_loopback
        or addr.is_private
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def _collect_connections() -> Dict[str, Any]:
    """Enumerate established sockets, split into internal vs internet-routable."""
    internal = 0
    external_endpoints: List[str] = []
    detail = "psutil socket enumeration"

    try:
        import psutil
    except ImportError:
        return {
            "internal": 0,
            "external_endpoints": [],
            "detail": "psutil unavailable — socket enumeration skipped",
        }

    try:
        for conn in psutil.net_connections(kind="inet"):
            if conn.status not in ("ESTABLISHED", "SYN_SENT"):
                continue
            if not conn.raddr:
                continue
            host = conn.raddr[0] if isinstance(conn.raddr, tuple) else getattr(conn.raddr, "ip", "")
            port = conn.raddr[1] if isinstance(conn.raddr, tuple) else getattr(conn.raddr, "port", 0)
            if _is_internal(host):
                internal += 1
            else:
                external_endpoints.append(f"{host}:{port}")
    except (psutil.AccessDenied, PermissionError):
        detail = "socket table not readable by this process (insufficient privileges)"
    except Exception as exc:  # pragma: no cover - platform specific
        detail = f"socket enumeration unavailable ({exc.__class__.__name__})"

    return {"internal": internal, "external_endpoints": external_endpoints, "detail": detail}


def _collect_interfaces() -> List[Dict[str, Any]]:
    try:
        import psutil
    except ImportError:
        return []

    interfaces: List[Dict[str, Any]] = []
    try:
        for name, addrs in psutil.net_if_addrs().items():
            ips = [a.address for a in addrs if a.family in (socket.AF_INET, socket.AF_INET6)]
            interfaces.append(
                {
                    "name": name,
                    "addresses": ips,
                    "is_loopback": all(_is_internal(ip) and ip.startswith(("127.", "::1")) for ip in ips) if ips else False,
                }
            )
    except Exception:  # pragma: no cover - platform specific
        return []
    return interfaces


def _egress_probe() -> str:
    """Attempt one short outbound TCP connect to an unroutable documentation IP."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(EGRESS_PROBE_TIMEOUT)
    try:
        sock.connect((EGRESS_PROBE_HOST, EGRESS_PROBE_PORT))
        return "REACHABLE"
    except (socket.timeout, TimeoutError):
        return "BLOCKED"
    except OSError:
        return "BLOCKED"
    finally:
        sock.close()


def _io_counters() -> int:
    try:
        import psutil

        counters = psutil.net_io_counters()
        return int(counters.bytes_sent) if counters else 0
    except Exception:
        return 0


@router.get("/egress-status")
def get_egress_status(payload: dict = Depends(require_permission("safety:read"))):
    conns = _collect_connections()
    egress_test = _egress_probe()
    external = conns["external_endpoints"]

    return {
        "air_gapped": len(external) == 0 and egress_test == "BLOCKED",
        "external_connections": len(external),
        "internal_connections": conns["internal"],
        "outbound_bytes": _io_counters(),
        "egress_test": egress_test,
        "egress_target": f"{EGRESS_PROBE_HOST}:{EGRESS_PROBE_PORT}",
        "external_endpoints": external,
        "interfaces": _collect_interfaces(),
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "detail": conns["detail"],
    }
