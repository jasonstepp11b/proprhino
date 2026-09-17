from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from app.database import create_db_and_tables, engine
from app.models import Account, Firm

app = FastAPI(title="Prop Firm Account Tracker")
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def dashboard(request: Request):
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
        firms = {f.id: f.name for f in session.exec(select(Firm)).all()}
    return templates.TemplateResponse(
        "dashboard.html", {"request": request, "accounts": accounts, "firms": firms}
    )
