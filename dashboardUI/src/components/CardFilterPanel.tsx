import { useCallback, useEffect, useMemo, useState } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import axios from "axios";
import {
  CompactFilterItem,
} from "./FilterPanel";
import {
  allFiltersSelector,
  filterNamesState,
} from "../recoil/FiltersFamily";
import { IsEditModeState } from "../recoil/IsEditeMode";
import {
  cardFilterIdsFamily,
  cardFilterPositionsFamily,
} from "../recoil/CardFilterPanelState";

interface CardFilterPanelProps {
  cardId: string;
  onClose: () => void;
}

const CardFilterPanel: React.FC<CardFilterPanelProps> = ({ cardId, onClose }) => {
  const [tempSelectedFilters, setTempSelectedFilters] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [activeFilterIds, setActiveFilterIds] = useRecoilState(
    cardFilterIdsFamily(cardId)
  );
  const [filterPositions, setFilterPositions] = useRecoilState(
    cardFilterPositionsFamily(cardId)
  );
  const allFilters = useRecoilValue(allFiltersSelector);
  const filterNames = useRecoilValue(filterNamesState);
  const isEditMode = useRecoilValue(IsEditModeState);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTempSelectedFilters(activeFilterIds);
  }, [activeFilterIds]);

  const persistCardFilters = useCallback(
    async (ids: string[], positions: Record<string, { x: number; y: number }>) => {
      try {
        setIsSaving(true);
        await axios.post(`http://localhost:3002/api/cards/${cardId}/filter-panel-state`, {
          activeFilterIds: ids,
          positions,
        });
      } catch (error) {
        console.warn("Failed to save card filter state:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [cardId]
  );

  const availableFilters = useMemo(() => {
    return filterNames
      .map((name) => allFilters[name])
      .filter((config): config is NonNullable<typeof config> => Boolean(config))
      .sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.displayName.localeCompare(b.displayName);
      });
  }, [allFilters, filterNames]);

  const handleToggleFilter = (filterName: string) => {
    if (filterName === "ALL") {
      if (tempSelectedFilters.length === filterNames.length) {
        setTempSelectedFilters([]);
      } else {
        setTempSelectedFilters(filterNames);
      }
    } else {
      if (tempSelectedFilters.includes(filterName)) {
        setTempSelectedFilters(tempSelectedFilters.filter((f) => f !== filterName));
      } else {
        setTempSelectedFilters([...tempSelectedFilters, filterName]);
      }
    }
  };

  const handleApplyFilters = () => {
    const filtersToAdd = tempSelectedFilters.filter((name) => !activeFilterIds.includes(name));
    const filtersToRemove = activeFilterIds.filter((name) => !tempSelectedFilters.includes(name));

    const newActiveFilters = tempSelectedFilters.filter((name) => filterNames.includes(name));
    setActiveFilterIds(newActiveFilters);

    const newPositions = { ...filterPositions };
    let yOffset = 6 + newActiveFilters.filter((id) => filterPositions[id]).length * 80;

    filtersToAdd.forEach((filterId) => {
      if (!newPositions[filterId]) {
        newPositions[filterId] = { x: 6, y: yOffset };
        yOffset += 80;
      }
    });

    filtersToRemove.forEach((filterId) => {
      delete newPositions[filterId];
    });

    setFilterPositions(newPositions);
    persistCardFilters(newActiveFilters, newPositions);
    setDropdownOpen(false);
  };

  const handleCancelFilters = () => {
    setTempSelectedFilters(activeFilterIds);
    setDropdownOpen(false);
  };

  const handleRemoveFilter = (filterId: string) => {
    setActiveFilterIds(activeFilterIds.filter((id) => id !== filterId));
    const newPositions = { ...filterPositions };
    delete newPositions[filterId];
    setFilterPositions(newPositions);
    persistCardFilters(activeFilterIds.filter((id) => id !== filterId), newPositions);
  };

  const handlePositionChange = (filterId: string, position: { x: number; y: number }) => {
    const updated = {
      ...filterPositions,
      [filterId]: position,
    };
    setFilterPositions(updated);
    persistCardFilters(activeFilterIds, updated);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        background: "linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%)",
        border: "1px solid rgba(102, 126, 234, 0.18)",
        borderRadius: 2,
        p: 1.5,
        boxShadow: "0 10px 30px rgba(102, 126, 234, 0.18)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#1f2937" }}>
          Filters
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          className="non-draggable-filter-btn"
          sx={{
            color: "#475569",
            "&:hover": {
              color: "#1f2937",
              bgcolor: "rgba(148, 163, 184, 0.2)",
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {isEditMode && (
        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel sx={{ color: "#667eea", "&.Mui-focused": { color: "#667eea" } }}>
            Add Filters
          </InputLabel>
          <Select
            multiple
            value={tempSelectedFilters}
            open={dropdownOpen}
            onOpen={() => {
              setTempSelectedFilters(activeFilterIds);
              setDropdownOpen(true);
            }}
            onClose={() => setDropdownOpen(false)}
            label="Add Filters"
            renderValue={(selected) => {
              if (selected.length === 0) return <em>No filters selected</em>;
              if (selected.length === filterNames.length) return `All Filters (${selected.length})`;
              return `${selected.length} filter${selected.length > 1 ? "s" : ""} selected`;
            }}
            sx={{
              bgcolor: "white",
              borderRadius: 1.5,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(102, 126, 234, 0.3)",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#667eea",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#667eea",
              },
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  maxHeight: 400,
                  "& .MuiList-root": { pt: 0 },
                },
              },
              autoFocus: false,
            }}
          >
            <MenuItem
              value="ALL"
              onClick={() => handleToggleFilter("ALL")}
              sx={{
                borderBottom: "1px solid #e2e8f0",
                bgcolor: "#f8fafc",
                "&:hover": {
                  bgcolor: "#f0f4ff",
                },
              }}
            >
              <Checkbox
                size="small"
                checked={tempSelectedFilters.length === filterNames.length}
                indeterminate={
                  tempSelectedFilters.length > 0 && tempSelectedFilters.length < filterNames.length
                }
                sx={{
                  color: "#667eea",
                  "&.Mui-checked": { color: "#667eea" },
                  "&.MuiCheckbox-indeterminate": { color: "#667eea" },
                }}
              />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip
                  label="ALL"
                  size="small"
                  sx={{
                    bgcolor: "#ede9fe",
                    color: "#7c3aed",
                    border: "1px solid #c4b5fd",
                    fontSize: "0.65rem",
                    height: 20,
                    fontWeight: 700,
                  }}
                />
                <Typography variant="body2" fontWeight={600}>
                  All Filters
                </Typography>
              </Box>
            </MenuItem>

            {availableFilters.map((config) => {
              const getCategoryChipColor = (category: string) => {
                switch (category.toLowerCase()) {
                  case "params":
                    return { bgcolor: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac" };
                  case "data-source":
                    return { bgcolor: "#faf5ff", color: "#9333ea", border: "1px solid #d8b4fe" };
                  case "hooks":
                    return { bgcolor: "#fff7ed", color: "#ea580c", border: "1px solid #fdba74" };
                  default:
                    return { bgcolor: "#f8fafc", color: "#64748b", border: "1px solid #cbd5e1" };
                }
              };

              const chipColor = getCategoryChipColor(config.category);
              const isChecked = tempSelectedFilters.includes(config.variableName);

              return (
                <MenuItem
                  key={config.variableName}
                  value={config.variableName}
                  onClick={() => handleToggleFilter(config.variableName)}
                  sx={{
                    "&:hover": {
                      bgcolor: "#f0f4ff",
                    },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={isChecked}
                    sx={{
                      color: "#667eea",
                      "&.Mui-checked": { color: "#667eea" },
                    }}
                  />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                    <Chip
                      label={config.category}
                      size="small"
                      sx={{
                        ...chipColor,
                        fontSize: "0.65rem",
                        height: 20,
                        fontWeight: 700,
                      }}
                    />
                    <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                      {config.displayName}
                    </Typography>
                  </Box>
                </MenuItem>
              );
            })}

            <Box
              sx={{
                p: 1.5,
                pt: 1,
                borderTop: "2px solid #e2e8f0",
                display: "flex",
                gap: 1,
                position: "sticky",
                bottom: 0,
                bgcolor: "white",
                zIndex: 1,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                fullWidth
                variant="outlined"
                onClick={handleCancelFilters}
                size="small"
                sx={{
                  borderColor: "#cbd5e1",
                  color: "#64748b",
                  fontWeight: 600,
                  borderRadius: 1.5,
                  "&:hover": {
                    borderColor: "#94a3b8",
                    bgcolor: "#f8fafc",
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                variant="contained"
                onClick={handleApplyFilters}
                size="small"
                sx={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  fontWeight: 600,
                  borderRadius: 1.5,
                  "&:hover": {
                    background: "linear-gradient(135deg, #5568d3 0%, #6a4190 100%)",
                  },
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : `Apply (${tempSelectedFilters.length})`}
              </Button>
            </Box>
          </Select>
        </FormControl>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {activeFilterIds.length === 0 ? (
          <Box
            sx={{
              textAlign: "center",
              py: 2,
              color: "#64748b",
              border: "1px dashed #cbd5e1",
              borderRadius: 2,
              bgcolor: "#fff",
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              No filters added yet
            </Typography>
            <Typography variant="caption" color="#94a3b8">
              Use Add Filters to include filters for this card
            </Typography>
          </Box>
        ) : (
          activeFilterIds.map((filterId) => (
            <CompactFilterItem
              key={filterId}
              variableName={filterId}
              onRemove={() => handleRemoveFilter(filterId)}
              position={filterPositions[filterId] || { x: 0, y: 0 }}
              onPositionChange={(pos) => handlePositionChange(filterId, pos)}
              variant="inline"
            />
          ))
        )}
      </Box>
    </Paper>
  );
};

export default CardFilterPanel;

