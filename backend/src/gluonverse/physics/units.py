from __future__ import annotations

from .constants import GEV_TO_MEV, MEV_TO_GEV, M_TO_FM, FM_TO_M


def gev_to_mev(value: float) -> float:
    return value * GEV_TO_MEV


def mev_to_gev(value: float) -> float:
    return value * MEV_TO_GEV


def fm_to_m(value: float) -> float:
    return value * FM_TO_M


def m_to_fm(value: float) -> float:
    return value * M_TO_FM

