import pyotp
from fastapi.testclient import TestClient

def test_login_success_requires_mfa(client: TestClient):
    res = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "Admin@Sovereign2026!"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["mfa_required"] is True
    assert "temp_token" in data
    assert data["username"] == "admin"

def test_login_invalid_password(client: TestClient):
    res = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "WrongPassword123!"
    })
    assert res.status_code == 401
    assert "Incorrect username or password" in res.json()["detail"]

def test_mfa_verification_success(client: TestClient):
    # Step 1: Login to get temp token
    login_res = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "Admin@Sovereign2026!"
    })
    temp_token = login_res.json()["temp_token"]

    # Step 2: Generate valid TOTP using known seed secret
    totp = pyotp.TOTP("JBSWY3DPEHPK3PXP")
    current_code = totp.now()

    # Step 3: Verify TOTP
    verify_res = client.post(
        "/api/auth/mfa-verify",
        headers={"Authorization": f"Bearer {temp_token}"},
        json={"code": current_code}
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert "access_token" in data
    assert data["role"] == "ADMINISTRATOR"
    assert "users:create" in data["permissions"]

def test_mfa_verification_invalid_code(client: TestClient):
    login_res = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "Admin@Sovereign2026!"
    })
    temp_token = login_res.json()["temp_token"]

    verify_res = client.post(
        "/api/auth/mfa-verify",
        headers={"Authorization": f"Bearer {temp_token}"},
        json={"code": "000000"}
    )
    assert verify_res.status_code == 401
    assert "Invalid TOTP code" in verify_res.json()["detail"]
