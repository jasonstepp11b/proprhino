from datetime import date, datetime, time
from typing import Optional

from sqlmodel import SQLModel, Field


class Firm(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    notes: Optional[str] = None


class PlanTemplate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    firm_id: int = Field(foreign_key="firm.id")
    plan_name: str
    account_size: float
    profit_target: float
    max_trailing_drawdown: float
    drawdown_type: str  # "eod" | "intraday"
    daily_loss_limit: Optional[float] = None
    daily_loss_behavior: str = "none"  # "soft_pause" | "breach" | "none"
    consistency_rule_pct: Optional[float] = None
    consistency_applies_to: str = "none"  # "eval" | "funded" | "both" | "none"
    max_contracts: Optional[int] = None
    mll_lock_threshold: float = 100
    min_trading_days: int = 1
    inactivity_days: int = 7


class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    firm_id: int = Field(foreign_key="firm.id")
    template_id: int = Field(foreign_key="plantemplate.id")
    nickname: str
    purchase_price: Optional[float] = None
    current_stage: str = "evaluation"  # evaluation | sim_funded | live | breached | passed
    stage_start_date: date
    stage_start_balance: float
    current_balance: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StageHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id")
    stage: str
    start_date: date
    end_date: Optional[date] = None
    ending_balance: Optional[float] = None
    outcome: Optional[str] = None


class Trade(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id")
    trade_date: date
    session: Optional[str] = None
    instrument: str
    contracts: int
    entry_time: Optional[time] = None
    exit_time: Optional[time] = None
    gross_pl: float
    commission: float = 0
    notes: Optional[str] = None

    @property
    def net_pl(self) -> float:
        return self.gross_pl - self.commission
