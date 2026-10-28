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
    reserved_quantity: int = 0
    available_quantity: Optional[int] = None
    current_price: float
    value: float

class PortfolioOut(BaseModel):
    portfolio_id: str
    portfolio_value: float
    cash_balance: float
    reserved_cash: float = 0.0
    available_cash: float = 0.0
    total_equity_value: float
    holdings: List[HoldingOut]
    pending_orders_count: int = 0
    last_updated: str
    is_live: bool = False
    price_status: str = "unverified"
    price_source: Optional[str] = None
    price_as_of: Optional[str] = None

class TradeRequest(BaseModel):
    holding_id: str
    side: str = Field(..., pattern="^(?i)(buy|sell)$")
    quantity: int = Field(..., gt=0)
    order_type: str = Field("market", pattern="^(?i)(market|limit)$")
    price: Optional[float] = None
    limit_price: Optional[float] = None
    confirmed: bool = False

class TradeResponse(BaseModel):
    success: bool
    simulated: bool = True
    status: str = "EXECUTED"  # "EXECUTED" | "PENDING" | "REJECTED"
    message: str
    trade_id: str
    holding_id: str
    holding_name: Optional[str] = None
    side: str
    order_type: str = "market"
    quantity: int
    price: float
    limit_price: Optional[float] = None
    executed_price: Optional[float] = None
    market_price: Optional[float] = None
    total_val: float
    timestamp: str

class PaperOrderOut(BaseModel):
    id: str
    portfolio_id: str
    holding_id: str
    holding_name: str
    ticker: str
    side: str
    order_type: str
    quantity: int
    price: float
    limit_price: Optional[float] = None
    executed_price: Optional[float] = None
    market_price: Optional[float] = None
    total_val: float
    status: str  # "PENDING", "EXECUTED", "CANCELLED", "REJECTED"
    confirmed: bool
    created_at: str
    executed_at: Optional[str] = None

class CancelOrderResponse(BaseModel):
    success: bool
    order_id: str
    status: str
    message: str

class ProcessedOrderResult(BaseModel):
    order_id: str
    holding_id: str
    holding_name: str
    side: str
    quantity: int
    limit_price: float
    executed_price: float
    total_val: float
    status: str
    message: str

class ProcessOrdersResponse(BaseModel):
    success: bool
    processed_count: int
    executed_count: int
    executed_orders: List[ProcessedOrderResult] = []
    message: str

