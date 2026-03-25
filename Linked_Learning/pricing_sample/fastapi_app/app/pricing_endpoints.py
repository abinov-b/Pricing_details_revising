from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.models import Item, PricingData, PricingDataSchema
from app.database import get_db
import os
import csv
import io
from datetime import datetime
from dateutil import parser as dateparser

router = APIRouter()

# In-memory store
items: dict[int, Item] = {}
_counter = 0


def _next_id() -> int:
    global _counter
    _counter += 1
    return _counter


@router.get("/items")
def list_items():
    return list(items.values())


@router.get("/items/{item_id}")
def get_item(item_id: int):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")
    return items[item_id]


@router.post("/items", status_code=201)
def create_item(item: Item):
    item.id = _next_id()
    items[item.id] = item
    return item


@router.put("/items/{item_id}")
def update_item(item_id: int, item: Item):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")
    item.id = item_id
    items[item_id] = item
    return item


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")
    del items[item_id]


UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/uploadPricingFile")
async def upload_pricing_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        if not file.filename.endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files are supported")
        content = await file.read()
        decoded = content.decode("utf-8")
        dialect = csv.Sniffer().sniff(decoded[:1024], delimiters=",\t")
        reader = csv.DictReader(io.StringIO(decoded), delimiter=dialect.delimiter)

        expected = {"store_id", "country", "sku", "product_name", "price", "date"}
        headers = set(reader.fieldnames or [])
        missing = expected - headers
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"CSV missing required columns: {missing}. Found: {headers}"
            )
        db.query(PricingData).delete()

        rows_inserted = 0
        for row in reader:
            record = PricingData(
                store_id=row["store_id"].strip(),
                country=row["country"].strip(),
                sku=row["sku"].strip(),
                product_name=row["product_name"].strip(),
                price=float(row["price"].strip()),
                date=dateparser.parse(row["date"].strip()),
            )
            db.add(record)
            rows_inserted += 1

        db.commit()

        # Return inserted rows with their DB-generated IDs
        records = db.query(PricingData).order_by(PricingData.id).all()
        data = [
            {
                "id": str(r.id),
                "store_id": r.store_id,
                "country": r.country,
                "sku": r.sku,
                "product_name": r.product_name,
                "price": str(r.price),
                "date": r.date.strftime("%Y-%m-%d") if r.date else "",
            }
            for r in records
        ]

        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "rows_inserted": rows_inserted,
            "data": data,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/modifyPricingData")
def modify_pricing_data(rows: list[PricingDataSchema], db: Session = Depends(get_db)):
    updated = 0
    for row in rows:
        record = db.query(PricingData).filter(PricingData.id == row.id).first()
        if not record:
            continue
        record.store_id = row.store_id
        record.country = row.country
        record.sku = row.sku
        record.product_name = row.product_name
        record.price = row.price
        record.date = dateparser.parse(row.date)
        updated += 1

    db.commit()
    return {"message": f"{updated} rows updated successfully", "updated": updated}


@router.get("/downloadPricingData")
def download_pricing_data(db: Session = Depends(get_db)):
    records = db.query(PricingData).order_by(PricingData.id).all()
    if not records:
        raise HTTPException(status_code=404, detail="No pricing data found in database")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "store_id", "country", "sku", "product_name", "price", "date"])
    for r in records:
        writer.writerow([
            r.id,
            r.store_id,
            r.country,
            r.sku,
            r.product_name,
            r.price,
            r.date.strftime("%Y-%m-%d") if r.date else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pricing_data.csv"},
    )
