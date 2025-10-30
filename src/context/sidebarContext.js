import { createContext, useContext, useEffect, useMemo, useState } from "react";

const SidebarContext = createContext(null);

const getIsMobile = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 992;
};

export const SidebarProvider = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(getIsMobile);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(getIsMobile());
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(false);
      setIsMobileOpen(false);
    }
  }, [isMobile]);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => !prev);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const toggleSidebar = () => {
    if (isMobile) {
      toggleMobileSidebar();
    } else {
      toggleCollapsed();
    }
  };

  const openSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(true);
    } else {
      setIsCollapsed(false);
    }
  };

  const closeSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  const value = useMemo(
    () => ({
      isCollapsed,
      isMobile,
      isMobileOpen,
      toggleSidebar,
      toggleCollapsed,
      toggleMobileSidebar,
      openSidebar,
      closeSidebar,
      setCollapsed: setIsCollapsed,
    }),
    [isCollapsed, isMobile, isMobileOpen]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

