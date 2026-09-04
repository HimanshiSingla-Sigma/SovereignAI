import uuid
from fastapi.testclient import TestClient

def test_admin_can_create_user(client: TestClient, admin_headers):
    unique_user = f"eng_{uuid.uuid4().hex[:6]}"
    res = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": unique_user,
            "email": f"{unique_user}@sovereign.local",
            "full_name": "Field Test Engineer",
            "password": "TestPassword@2026!",
            "role": "ENGINEER"
        }
    )
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == unique_user
    assert "ENGINEER" in data["roles"]

def test_non_admin_cannot_create_user(client: TestClient, engineer_headers, operator_headers):
    # Engineer attempt
    res_eng = client.post(
        "/api/users",
        headers=engineer_headers,
        json={
            "username": "unauthorized_user",
            "email": "unauth@sovereign.local",
            "password": "Password123!",
            "role": "OPERATOR"
        }
    )
    assert res_eng.status_code == 403
    assert "Access Denied" in res_eng.json()["detail"]

    # Operator attempt
    res_op = client.post(
        "/api/users",
        headers=operator_headers,
        json={
            "username": "unauthorized_user2",
            "email": "unauth2@sovereign.local",
            "password": "Password123!",
            "role": "OPERATOR"
        }
    )
    assert res_op.status_code == 403

def test_unauthenticated_request_rejected(client: TestClient):
    res = client.get("/api/users")
    assert res.status_code == 401
