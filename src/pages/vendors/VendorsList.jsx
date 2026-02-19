import { useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import List from "../list/List";
import { vendorColumns, vendorPausedColumns } from "../../datatablesource";
import {
  normalizeVendorStatus,
  isVendorStatus,
  resolveVendorStatus,
  getVendorStatusLabel,
  isVendorPaused,
} from "../../utils/vendorStatus";

const VendorsList = () => {
  const { statusId } = useParams();

  const normalizedStatus = useMemo(() => {
    if (!statusId) return null;
    const normalized = normalizeVendorStatus(statusId);
    return normalized && isVendorStatus(normalized) ? normalized : null;
  }, [statusId]);

  const filterCallback = useMemo(() => {
    if (!normalizedStatus) return null;
    if (normalizedStatus === "paused") {
      return (row) => isVendorPaused(row);
    }
    return (row) => resolveVendorStatus(row, "draft") === normalizedStatus;
  }, [normalizedStatus]);

  if (statusId && !normalizedStatus) {
    return <Navigate to="/vendors" replace />;
  }

  const baseTitle = "vendors";
  const pageTitle = normalizedStatus
    ? `${baseTitle} (${getVendorStatusLabel(normalizedStatus)})`
    : `${baseTitle} (Tous)`;
  const disableCreate = Boolean(normalizedStatus);
  const columns = normalizedStatus === "paused" ? vendorPausedColumns : vendorColumns;

  return (
    <List
      typeColumns={columns}
      title="vendors"
      dataFilter={filterCallback}
      pageTitle={pageTitle}
      disableCreate={disableCreate}
    />
  );
};

export default VendorsList;
