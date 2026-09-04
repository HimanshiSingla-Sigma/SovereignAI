from fastapi.testclient import TestClient

def test_rag_query_with_citations(client: TestClient, engineer_headers):
    res = client.post(
        "/api/rag/query",
        headers=engineer_headers,
        json={
            "query": "What is the procedure for Spindle Bearing B-201 lubrication?",
            "top_k": 3
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert len(data["citations"]) > 0
    # Check citation contents
    top_citation = data["citations"][0]
    assert "SOP-MNT-042" in top_citation["title"] or "DOC-" in top_citation["doc_id"]
    assert top_citation["relevance_score"] > 0.1

def test_knowledge_graph_structure(client: TestClient, engineer_headers):
    res = client.get("/api/graphrag/graph", headers=engineer_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) >= 10
    assert len(data["edges"]) >= 8

    # Verify edge types
    edge_types = {e["type"] for e in data["edges"]}
    assert "HAS_COMPONENT" in edge_types
    assert "HAD_FAILURE" in edge_types
    assert "GENERATED_INCIDENT" in edge_types

def test_graphrag_root_cause_analysis(client: TestClient, engineer_headers):
    res = client.get("/api/graphrag/root-cause/Machine-002", headers=engineer_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["target_entity"] == "Machine-002"
    assert "causal_chain" in data
    assert len(data["causal_chain"]) > 0
    assert "probable_root_cause" in data
    assert "recommended_mitigation" in data
