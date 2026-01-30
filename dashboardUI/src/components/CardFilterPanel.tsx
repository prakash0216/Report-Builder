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
import { API_BASE_URL } from '../config/api.config';
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
      // Deduplicate to avoid duplicate inserts and unique constraint errors
      const uniqueIds = Array.from(new Set(ids));
      try {
        setIsSaving(true);
        await axios.post(`${API_BASE_URL}/api/cards/${cardId}/filter-panel-state`, {
          activeFilterIds: uniqueIds,
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
    const dedupTemp = Array.from(new Set(tempSelectedFilters));
    const filtersToAdd = dedupTemp.filter((name) => !activeFilterIds.includes(name));
    const filtersToRemove = activeFilterIds.filter((name) => !dedupTemp.includes(name));

    const newActiveFilters = dedupTemp.filter((name) => filterNames.includes(name));
    setActiveFilterIds(newActiveFilters);

    const newPositions = { ...filterPositions };
    // Don't set initial positions for new filters - let them use flexbox layout
    // Positions will be set only when user drags them

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
    const nextIds = activeFilterIds.filter((id) => id !== filterId);
    setActiveFilterIds(nextIds);
    const newPositions = { ...filterPositions };
    delete newPositions[filterId];
    setFilterPositions(newPositions);
    persistCardFilters(nextIds, newPositions);
  };

  const handlePositionChange = (filterId: string, position: { x: number; y: number }) => {
    const updated = {
      ...filterPositions,
      [filterId]: position,
    };
    const dedupIds = Array.from(new Set(activeFilterIds));
    setFilterPositions(updated);
    persistCardFilters(dedupIds, updated);
  };

  const isPositioned = (pos?: { x: number; y: number }) =>
    pos !== undefined && typeof pos.x === "number" && typeof pos.y === "number" && pos.x >= 0 && pos.y >= 0;

  const positionedCount = activeFilterIds.filter((id) => isPositioned(filterPositions[id])).length;
  const minHeight = positionedCount > 0 ? Math.ceil(positionedCount / 2) * 85 : undefined;

  return (
    <Paper
      elevation={0}
      className="card-filter-panel"
      sx={{
        width: "100%",
        maxWidth: "100%", // Ensure it doesn't exceed parent width
        background: "linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.95) 100%)",
        border: "1px solid rgba(102, 126, 234, 0.18)",
        borderRadius: 2,
        p: 2,
        boxShadow: "0 10px 30px rgba(102, 126, 234, 0.18)",
        overflow: "hidden", // Prevent content from overflowing
        boxSizing: "border-box", // Include padding in width calculation
      }}
    >

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

      <Box 
        sx={{ 
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          py:1,
          background: "transparent",
          minHeight, // add space if any positioned filters exist
          width: "100%",
          maxWidth: "100%", // Ensure it doesn't exceed parent
          overflow: "hidden", // Prevent overflow
          boxSizing: "border-box",
          position: "relative", // Needed for absolute positioned children (after dragging)
        }}
      >
        {activeFilterIds.length === 0 ? (
          <Box
            sx={{
              textAlign: "center",
              py: 2,
              px: 3,
              color: "#64748b",
              border: "1px dashed #cbd5e1",
              borderRadius: 2,
              bgcolor: "#fff",
              width: "100%",
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
          activeFilterIds.map((filterId) => {
            const storedPos = filterPositions[filterId];
            const validPos = isPositioned(storedPos) ? storedPos : undefined;
            return (
              <CompactFilterItem
                key={filterId}
                variableName={filterId}
                onRemove={() => handleRemoveFilter(filterId)}
                position={validPos} // undefined => flex layout; defined => absolute
                onPositionChange={(pos) => handlePositionChange(filterId, pos)}
                variant="inline"
              />
            );
          })
        )}
      </Box>
    </Paper>
  );
};

export default CardFilterPanel;

