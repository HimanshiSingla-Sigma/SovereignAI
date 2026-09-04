import os
import shutil
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.core.mfa import generate_totp_secret
from app.core.rbac import (
    ROLE_ADMINISTRATOR, ROLE_ENGINEER, ROLE_SAFETY_OFFICER, ROLE_OPERATOR,
    PERMISSIONS, ROLE_PERMISSIONS_MATRIX
)
from app.models.all_models import (
    User, Role, Permission, RolePermission, UserRole, MFACredential,
    Machine, Component, Sensor, SafetyRule, Document, DocumentChunk
)
from app.digital_twin.assets import INITIAL_ASSETS, AssetRegistry
from app.safety.rules import DEFAULT_SAFETY_RULES
from app.rag.ocr_engine import LocalOCREngine
from app.rag.chunker import DocumentChunker
from app.rag.vector_store import LocalVectorStore
from app.core.config import settings

SAMPLE_DOCUMENTS = [
    {
        "doc_id": "DOC-SOP-042",
        "title": "SOP-MNT-042: High-Precision Spindle Bearing Lubrication & Alignment",
        "filename": "SOP-MNT-042.txt",
        "classification": "INTERNAL",
        "content": """STANDARD OPERATING PROCEDURE: SOP-MNT-042
TITLE: Industrial Spindle Angular Contact Bearing Lubrication & Inspection
REVISION: 4.2 | ASSET APPLICABILITY: Machine-001, Machine-002, Turning Centers

1. PURPOSE & SCOPE
This procedure specifies mandatory preventive maintenance for high-speed angular contact spindle bearings (Type B-201 and ceramic hybrid variants). Adherence prevents inner race spalling, fatigue cracking, and severe radial vibration trips.

2. SYMPTOMS OF LUBRICATION BREAKDOWN
- Radial vibration exceeding ISO 10816 threshold of 2.8 mm/s in frequency bands 1.5x to 3.2x rotational speed.
- Localized bearing housing temperature climbing past 75°C under nominal motor current load (indicates thermal divergence due to grease starvation or unbalance).
- Acoustic high-frequency friction whistling.

3. REMEDIATION PROTOCOL
Step 1: Safely reduce spindle RPM below 1200 RPM before engaging mechanical interlocks.
Step 2: Isolate electrical supply and apply Lockout/Tagout (LOTO).
Step 3: Purge degraded synthetic polyurea grease and inspect for metallic debris using optical inspection.
Step 4: Replenish with exactly 12 ml of Klüber Isoflex NBU 15 high-speed spindle grease.
Step 5: Perform dynamic run-in cycle: 20 minutes at 500 RPM, 20 minutes at 1500 RPM, monitoring vibration until baseline under 1.5 mm/s is restored."""
    },
    {
        "doc_id": "DOC-INC-2025-08",
        "title": "Post-Incident Investigation Report: INC-2025-08-04 Spindle Vibration Trip",
        "filename": "INC-2025-08-04.txt",
        "classification": "CONFIDENTIAL",
        "content": """SOVEREIGN INDUSTRIAL INCIDENT INVESTIGATION REPORT
INCIDENT CODE: INC-2025-08-04 | CLASSIFICATION: CONFIDENTIAL
ASSET: Machine-002 (Heavy Duty Turning Center) | INVESTIGATOR: Senior Reliability Engineer

EXECUTIVE SUMMARY
On August 4, 2025, Machine-002 experienced an unexpected automatic emergency trip when radial vibration spiked to 4.6 mm/s, breaching the critical safety rule SR-VIB-02 (4.5 mm/s threshold). 

ROOT CAUSE ANALYSIS
Detailed metallurgical examination of Spindle Bearing B-201 revealed:
1. Significant grease breakdown caused by continuous operation at elevated ambient temperature without intermediate relubrication.
2. Micro-spalling along the inner raceway, causing high harmonic excitation.
3. Drive motor current remained steady at 28-30A, proving the issue was purely mechanical friction, not an electrical drive fault.

CORRECTIVE ACTIONS
1. Updated preventive maintenance intervals from 6 months to 60 operating days.
2. Required continuous cross-sensor correlation monitoring between temperature and vibration.
3. Verified compliance with SOP-MNT-042."""
    },
    {
        "doc_id": "DOC-SOP-ESD",
        "title": "SOP-SAF-001: Emergency Shutdown & Actuator Isolation Protocols",
        "filename": "SOP-SAF-001.txt",
        "classification": "INTERNAL",
        "content": """SAFETY OPERATING PROCEDURE: SOP-SAF-001
TITLE: Industrial Plant Emergency Shutdown (ESD) and Actuator Interlocks
AUTHORITY: Chief Safety Officer | JURISDICTION: All Active Autonomous Workcells

1. DETERMINISTIC SAFETY ENGINE GOVERNANCE
Under Sovereign Industrial Architecture, artificial intelligence agents are advisory only. Under no circumstances may an AI model or autonomous script trigger physical actuator commands directly.

2. SHUTDOWN CRITERIA
- Temperature >= 95.0°C or Vibration >= 4.5 mm/s mandates immediate trip or Safety Officer intervention.
- Combustible Gas >= 50.0 ppm mandates immediate automatic hardware interlock trip.

3. HUMAN-IN-THE-LOOP (HITL) REQUIREMENT
Any manual or AI-recommended emergency shutdown or speed throttle requires cryptographic approval from a verified Safety Officer or Administrator, logged immutably in the system audit trail."""
    }
]

def seed_database():
    """Initializes schema and populates all baseline seed records."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # 1. Seed Permissions
        perm_map = {}
        for code, desc in PERMISSIONS.items():
            perm = db.query(Permission).filter_by(code=code).first()
            if not perm:
                perm = Permission(code=code, description=desc, category=code.split(":")[0])
                db.add(perm)
                db.flush()
            perm_map[code] = perm

        # 2. Seed Roles
        role_map = {}
        for role_name, perms_set in ROLE_PERMISSIONS_MATRIX.items():
            role = db.query(Role).filter_by(name=role_name).first()
            if not role:
                role = Role(name=role_name, description=f"Sovereign {role_name} Role")
                db.add(role)
                db.flush()
            role_map[role_name] = role

            # Link permissions
            for code in perms_set:
                p_obj = perm_map.get(code)
                if p_obj and p_obj not in role.permissions:
                    role.permissions.append(p_obj)

        # 3. Seed Default Admin User
        admin_user = db.query(User).filter_by(username="admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@sovereign.local",
                full_name="Lead System Administrator",
                hashed_password=hash_password("Admin@Sovereign2026!"),
                is_active=True,
                is_admin=True,
                mfa_enabled=True
            )
            admin_user.roles.append(role_map[ROLE_ADMINISTRATOR])
            db.add(admin_user)
            db.flush()

            # Pre-create verified MFA secret for seamless testing
            mfa_cred = MFACredential(
                user_id=admin_user.id,
                secret="JBSWY3DPEHPK3PXP",  # Standard known base32 test secret
                is_verified=True,
                verified_at=datetime.now(timezone.utc)
            )
            db.add(mfa_cred)

        # 4. Seed Default Engineer User
        eng_user = db.query(User).filter_by(username="engineer1").first()
        if not eng_user:
            eng_user = User(
                username="engineer1",
                email="engineer@sovereign.local",
                full_name="Senior Reliability Engineer",
                hashed_password=hash_password("Engineer@2026!"),
                is_active=True,
                is_admin=False,
                mfa_enabled=True
            )
            eng_user.roles.append(role_map[ROLE_ENGINEER])
            db.add(eng_user)
            db.flush()
            db.add(MFACredential(
                user_id=eng_user.id,
                secret="JBSWY3DPEHPK3PXP",
                is_verified=True,
                verified_at=datetime.now(timezone.utc)
            ))

        # 5. Seed Default Safety Officer User
        safety_user = db.query(User).filter_by(username="safety1").first()
        if not safety_user:
            safety_user = User(
                username="safety1",
                email="safety@sovereign.local",
                full_name="Chief Safety Officer",
                hashed_password=hash_password("Safety@2026!"),
                is_active=True,
                is_admin=False,
                mfa_enabled=True
            )
            safety_user.roles.append(role_map[ROLE_SAFETY_OFFICER])
            db.add(safety_user)
            db.flush()
            db.add(MFACredential(
                user_id=safety_user.id,
                secret="JBSWY3DPEHPK3PXP",
                is_verified=True,
                verified_at=datetime.now(timezone.utc)
            ))

        # 6. Seed Default Operator User
        op_user = db.query(User).filter_by(username="operator1").first()
        if not op_user:
            op_user = User(
                username="operator1",
                email="operator@sovereign.local",
                full_name="Plant Operations Specialist",
                hashed_password=hash_password("Operator@2026!"),
                is_active=True,
                is_admin=False,
                mfa_enabled=True
            )
            op_user.roles.append(role_map[ROLE_OPERATOR])
            db.add(op_user)
            db.flush()
            db.add(MFACredential(
                user_id=op_user.id,
                secret="JBSWY3DPEHPK3PXP",
                is_verified=True,
                verified_at=datetime.now(timezone.utc)
            ))

        # 7. Seed Machines and Components
        for item in INITIAL_ASSETS:
            mach = db.query(Machine).filter_by(machine_id=item["machine_id"]).first()
            if not mach:
                mach = Machine(
                    machine_id=item["machine_id"],
                    name=item["name"],
                    category=item["category"],
                    status=item["status"],
                    simulation_profile=item["simulation_profile"],
                    health_score=item["health_score"],
                    risk_score=item["risk_score"],
                    anomaly_score=item["anomaly_score"],
                    rpm=item["rpm"],
                    operating_hours=item["operating_hours"]
                )
                db.add(mach)
                db.flush()

                for c_item in item["components"]:
                    comp = Component(
                        machine_id=mach.id,
                        component_id=c_item["component_id"],
                        name=c_item["name"],
                        component_type=c_item["component_type"],
                        health_score=c_item["health_score"],
                        wear_percentage=c_item["wear_percentage"]
                    )
                    db.add(comp)
                    db.flush()

                for s_item in item["sensors"]:
                    sensor = Sensor(
                        machine_id=mach.id,
                        sensor_id=s_item["sensor_id"],
                        sensor_type=s_item["sensor_type"],
                        unit=s_item["unit"],
                        min_threshold=s_item["min_threshold"],
                        max_threshold=s_item["max_threshold"],
                        last_value=s_item["last_value"],
                        is_healthy=s_item["is_healthy"]
                    )
                    db.add(sensor)

        # 8. Seed Safety Rules
        for r_item in DEFAULT_SAFETY_RULES:
            rule = db.query(SafetyRule).filter_by(rule_id=r_item["rule_id"]).first()
            if not rule:
                rule = SafetyRule(
                    rule_id=r_item["rule_id"],
                    name=r_item["name"],
                    parameter=r_item["parameter"],
                    operator=r_item["operator"],
                    threshold=r_item["threshold"],
                    severity=r_item["severity"],
                    action_required=r_item["action_required"],
                    is_active=r_item["is_active"]
                )
                db.add(rule)

        # 9. Seed Sample Documents & Ingest into Local RAG Vector Store
        all_chunks_to_index = []
        for doc_def in SAMPLE_DOCUMENTS:
            doc_file_path = os.path.join(settings.DOCUMENTS_DIR, doc_def["filename"])
            with open(doc_file_path, "w", encoding="utf-8") as f:
                f.write(doc_def["content"])

            doc_record = db.query(Document).filter_by(doc_id=doc_def["doc_id"]).first()
            if not doc_record:
                doc_record = Document(
                    doc_id=doc_def["doc_id"],
                    title=doc_def["title"],
                    filename=doc_def["filename"],
                    file_type="TXT",
                    file_size_bytes=len(doc_def["content"].encode("utf-8")),
                    classification=doc_def["classification"],
                    file_hash="seeded_hash_" + doc_def["doc_id"],
                    storage_path=doc_file_path,
                    uploaded_by="SystemSeed",
                    is_indexed=True
                )
                db.add(doc_record)
                db.flush()

                # Chunk document
                pages = [{"page_number": 1, "text": doc_def["content"]}]
                chunks = DocumentChunker.chunk_document(
                    doc_id=doc_def["doc_id"],
                    title=doc_def["title"],
                    classification=doc_def["classification"],
                    pages=pages
                )

                for ch in chunks:
                    chunk_row = DocumentChunk(
                        document_id=doc_record.id,
                        chunk_index=int(ch["chunk_id"].split("-")[-1]),
                        page_number=ch["page_number"],
                        content=ch["content"],
                        classification=ch["classification"],
                        token_count=ch["word_count"]
                    )
                    db.add(chunk_row)
                    all_chunks_to_index.append(ch)

        # Ingest into vector store
        if all_chunks_to_index:
            LocalVectorStore.add_chunks(all_chunks_to_index)

        db.commit()
        print("Database seeded successfully with Users, Roles, Machines, Rules, and Documents.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
