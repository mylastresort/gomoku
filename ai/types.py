"""
types.py

shared types and small result objects used by the search
Keeping them here to avoid circular imports between logic modules
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

Board = List[List[int]]
Move = Tuple[int, int]


@dataclass
class SearchStats:
    nodes: int = 0
    cutoffs: int = 0
    max_depth_reached: int = 0
    elapsed_ms: float = 0.0


@dataclass
class SearchResult:
    move: Optional[Move]
    score: float
    depth_reached: int
    stats: SearchStats

