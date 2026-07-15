# Units

The MVP uses natural units by default:

```text
c = 1
hbar = 1
```

Internal educational quantities are dimensionless unless a model explicitly
declares otherwise. Display conversion helpers expose common labels:

- Energy: eV, MeV, GeV.
- Distance: fm.
- Time: seconds and natural-time display units.

## Rules

- Do not mix units without explicit conversion.
- Every observable declares a unit.
- Every export records the unit system.
- Visual sizes are render scales, not physical size.

## Constants

The central backend constants module defines:

- `SPEED_OF_LIGHT_NATURAL = 1`
- `HBAR_NATURAL = 1`
- `GEV_TO_MEV = 1000`
- `FM_TO_M = 1e-15`

