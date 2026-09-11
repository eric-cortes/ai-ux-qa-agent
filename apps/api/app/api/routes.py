from fastapi import APIRouter, HTTPException

from app.schemas.finding import FindingResponse
from app.schemas.run import CreateRunRequest, RunResponse
from app.services.artifacts import read_json_artifact
from app.services.runs import clear_runs, create_run, get_run, list_runs

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/runs", response_model=list[RunResponse])
def get_runs() -> list[RunResponse]:
    return list_runs()


@router.delete("/runs", status_code=204)
def delete_runs() -> None:
    clear_runs()


@router.get("/runs/{run_id}", response_model=RunResponse)
def get_run_by_id(run_id: str) -> RunResponse:
    run = get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/runs/{run_id}/evidence")
def get_run_evidence(run_id: str):
    evidence = read_json_artifact(run_id, "evidence.json")
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence


@router.get("/runs/{run_id}/findings", response_model=list[FindingResponse])
def get_run_findings(run_id: str) -> list[FindingResponse]:
    findings = read_json_artifact(run_id, "findings.json")
    if findings is None:
        return []
    return [FindingResponse(**item) for item in findings.get("findings", [])]


@router.post("/runs", response_model=RunResponse, status_code=201)
def post_run(payload: CreateRunRequest) -> RunResponse:
    return create_run(payload)
