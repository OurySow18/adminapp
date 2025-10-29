import { useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import List from "../list/List";
import { vendorColumns } from "../../datatablesource";
import {
  normalizeVendorStatus,
  isVendorStatus,
  resolveVendorStatus,
  getVendorStatusLabel,
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

  return (
    <List
      typeColumns={vendorColumns}
      title="vendors"
      dataFilter={filterCallback}
      pageTitle={pageTitle}
      disableCreate={disableCreate}
    />
  );
};

export default VendorsList;
