from pydantic import BaseModel, Field
from typing import List, Optional

class HoldingOut(BaseModel):
    id: str
    name: str
    ticker: str
    sector: str
    weight: float
    beta: float
    day: float
    quantity: int
    current_price: float
    value: float

class PortfolioOut(BaseModel):
    portfolio_id: str
    portfolio_value: float
    cash_balance: float
    total_equity_value: float
    holdings: List[HoldingOut]
    last_updated: str
    is_live: bool = False

class TradeRequest(BaseModel):
    holding_id: str
    side: str = Field(..., pattern="^(buy|sell)$")
    quantity: int = Field(..., gt=0)
    price: Optional[float] = None
    confirmed: bool = True

class TradeResponse(BaseModel):
    success: bool
    simulated: bool = True
    message: str
    trade_id: str
    holding_id: str
    side: str
    quantity: int
    price: float
    total_val: float
    timestamp: str
