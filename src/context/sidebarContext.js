import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

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

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      toggleMobileSidebar();
    } else {
      toggleCollapsed();
    }
  }, [isMobile, toggleCollapsed, toggleMobileSidebar]);

  const openSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen(true);
    } else {
      setIsCollapsed(false);
    }
  }, [isMobile]);

  const closeSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  }, [isMobile]);

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
    [
      isCollapsed,
      isMobile,
      isMobileOpen,
      toggleSidebar,
      toggleCollapsed,
      toggleMobileSidebar,
      openSidebar,
      closeSidebar,
    ]
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
