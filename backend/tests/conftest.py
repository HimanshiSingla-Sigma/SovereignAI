import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.core.rbac import ROLE_ADMINISTRATOR, ROLE_ENGINEER, ROLE_SAFETY_OFFICER, ROLE_OPERATOR, ROLE_PERMISSIONS_MATRIX
from app.digital_twin.assets import AssetRegistry
from app.seed_data import seed_database

@pytest.fixture(scope="session", autouse=True)
def setup_test_suite():
    seed_database()
    AssetRegistry.initialize()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def admin_headers():
    token = create_access_token({
        "sub": "admin",
        "user_id": 1,
        "role": ROLE_ADMINISTRATOR,
        "permissions": list(ROLE_PERMISSIONS_MATRIX[ROLE_ADMINISTRATOR]),
        "mfa_required": True,
        "mfa_verified": True
    })
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def engineer_headers():
    token = create_access_token({
        "sub": "engineer1",
        "user_id": 2,
        "role": ROLE_ENGINEER,
        "permissions": list(ROLE_PERMISSIONS_MATRIX[ROLE_ENGINEER]),
        "mfa_required": True,
        "mfa_verified": True
    })
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def safety_headers():
    token = create_access_token({
        "sub": "safety1",
        "user_id": 3,
        "role": ROLE_SAFETY_OFFICER,
        "permissions": list(ROLE_PERMISSIONS_MATRIX[ROLE_SAFETY_OFFICER]),
        "mfa_required": True,
        "mfa_verified": True
    })
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def operator_headers():
    token = create_access_token({
        "sub": "operator1",
        "user_id": 4,
        "role": ROLE_OPERATOR,
        "permissions": list(ROLE_PERMISSIONS_MATRIX[ROLE_OPERATOR]),
        "mfa_required": True,
        "mfa_verified": True
    })
    return {"Authorization": f"Bearer {token}"}
