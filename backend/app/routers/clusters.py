from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..db import models as db
from ..deps import get_db

router = APIRouter(prefix="/api/clusters", tags=["clusters"])


@router.get("", response_model=list[schemas.ClusterOut])
def list_clusters(session: Session = Depends(get_db)):
    clusters = session.scalars(select(db.Cluster)).all()
    out = []
    for c in clusters:
        factory_count = session.scalar(
            select(func.count(db.Factory.id)).where(db.Factory.cluster_id == c.id)
        ) or 0
        open_anomaly_count = session.scalar(
            select(func.count(db.Anomaly.id))
            .join(db.Equipment, db.Anomaly.equipment_id == db.Equipment.id)
            .join(db.Factory, db.Equipment.factory_id == db.Factory.id)
            .where(db.Factory.cluster_id == c.id, db.Anomaly.status == "open")
        ) or 0
        out.append(schemas.ClusterOut(
            id=c.id, name=c.name, district=c.district, lat=c.lat, lon=c.lon,
            dominant_sectors=c.dominant_sectors, source=c.source, confidence=c.confidence,
            factory_count=factory_count, open_anomaly_count=open_anomaly_count,
        ))
    return out


@router.get("/{cluster_id}/factories", response_model=list[schemas.FactorySummaryOut])
def factories_in_cluster(cluster_id: str, session: Session = Depends(get_db)):
    cluster = session.get(db.Cluster, cluster_id)
    if cluster is None:
        raise HTTPException(404, f"cluster '{cluster_id}' not found")
    factories = session.scalars(select(db.Factory).where(db.Factory.cluster_id == cluster_id)).all()
    return factories
