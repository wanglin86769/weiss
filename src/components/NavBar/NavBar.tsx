import { useState } from "react";
import MuiAppBar from "@mui/material/AppBar";
import type { AppBarProps as MuiAppBarProps } from "@mui/material/AppBar";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Tooltip from "@mui/material/Tooltip";
import { COLORS, RUNTIME_MODE, EDIT_MODE, APP_SRC_URL } from "@src/constants/constants";
import { useEditorContext } from "@src/context/useEditorContext.tsx";
import { WIDGET_SELECTOR_WIDTH } from "@src/constants/constants";
import "./NavBar.css";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import GitHubIcon from "@mui/icons-material/GitHub";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon.tsx";
import ComputerIcon from "@mui/icons-material/Computer";
import HelpOverlay from "./HelpOverlay.tsx";
import { ListItemIcon, ListItemText, Menu, MenuItem, Avatar, Divider } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import PersonIcon from "@mui/icons-material/Person";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import MicrosoftIcon from "@mui/icons-material/Microsoft";
import { Roles, type OAuthProvider } from "@src/services/AuthService/AuthService.ts";
import { OAuthProviders } from "@src/services/AuthService/AuthService.ts";

interface StyledAppBarProps extends MuiAppBarProps {
  open?: boolean;
  drawerWidth: number;
}

const ModeSwitch = styled(Switch)(({ theme }) => ({
  padding: 8,
  "& .MuiSwitch-switchBase": {
    transitionDuration: "300ms",
    "&.Mui-checked": {
      "& + .MuiSwitch-track": {
        backgroundColor: COLORS.highlighted,
        opacity: 1,
        border: 0,
      },
    },
  },
  "& .MuiSwitch-track": {
    borderRadius: 22 / 2,
    "&::before, &::after": {
      content: '""',
      position: "absolute",
      top: "50%",
      transform: "translateY(-50%)",
      width: 16,
      height: 16,
    },
    "&::before": {
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24"><path fill="${encodeURIComponent(
        theme.palette.getContrastText(theme.palette.primary.main)
      )}" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>')`,
      left: 12,
    },
    "&::after": {
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24"><path fill="${encodeURIComponent(
        theme.palette.getContrastText(theme.palette.primary.main)
      )}" d="M19,13H5V11H19V13Z" /></svg>')`,
      right: 12,
    },
  },
  "& .MuiSwitch-thumb": {
    boxShadow: "none",
    width: 16,
    height: 16,
    margin: 2,
  },
}));

const StyledAppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open" && prop !== "drawerWidth",
})<StyledAppBarProps>(({ theme, open, drawerWidth }) => ({
  zIndex: theme.zIndex.drawer + 1,
  backgroundColor: COLORS.titleBarColor,
  transition: theme.transitions.create(["width", "margin"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

export default function NavBar() {
  const {
    inEditMode,
    updateMode,
    wdgPickerOpen,
    setWdgPickerOpen,
    downloadWidgets,
    loadWidgets,
    isDemo,
    user,
    isAuthenticated,
    login,
    logout,
  } = useEditorContext();
  const drawerWidth = WIDGET_SELECTOR_WIDTH;
  const [importMenuAnchor, setImportMenuAnchor] = useState<null | HTMLElement>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const handleImportMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setImportMenuAnchor(event.currentTarget);
  };

  const handleImportMenuClose = () => {
    setImportMenuAnchor(null);
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleDownload = () => {
    void downloadWidgets();
  };

  const handleImportFile = () => {
    handleImportMenuClose();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        loadWidgets(text);
      } catch (err) {
        console.error("Failed to read file:", err);
      }
    };
    input.click();
  };

  const handleImportGitRepo = () => {
    handleImportMenuClose();
    window.alert("Import from Git repository coming soon.");
  };

  const handleLoadDemo = async () => {
    try {
      const url =
        "https://raw.githubusercontent.com/weiss-controls/weiss/main/examples/example-opi.json";

      const res = await fetch(url);
      if (!res.ok) {
        console.error("Failed to fetch example-opi.json");
        return;
      }

      const text = await res.text();
      loadWidgets(text);
    } catch (err) {
      console.error("Load demo failed:", err);
    }
  };

  const handleLogin = async (provider: OAuthProvider, demoProfile?: Roles) => {
    handleUserMenuClose();
    if (isAuthenticated) return;
    if (provider === OAuthProviders.DEMO && !demoProfile) {
      console.error("Demo profile must be specified for demo login");
      return;
    }
    await login(provider, demoProfile);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    logout();
  };

  return (
    <Box sx={{ display: "flex" }}>
      <StyledAppBar component="nav" position="fixed" open={wdgPickerOpen} drawerWidth={drawerWidth}>
        <Toolbar sx={{ minHeight: 56, px: 2 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={() => setWdgPickerOpen((o) => !o)}
            sx={{
              mr: 2,
              size: "small",
              visibility: inEditMode ? "visible" : "hidden",
            }}
          >
            <MenuIcon />
          </IconButton>
          <Tooltip title="Web EPICS Interface & Synoptic Studio">
            <Typography
              noWrap
              component="div"
              sx={{
                fontSize: 22,
                ml: 4,
                mr: 3,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: ".5rem",
                textDecoration: "none",
              }}
            >
              WEISS
            </Typography>
          </Tooltip>
          <FormControlLabel
            control={
              <ModeSwitch
                checked={!inEditMode}
                onChange={() => updateMode(inEditMode ? RUNTIME_MODE : EDIT_MODE)}
                color="default"
                sx={{ mr: 1 }}
              />
            }
            label="Runtime"
            sx={{ color: "white", ml: 3 }}
          />
          {isDemo && inEditMode && (
            <Tooltip title="Load demo OPI">
              <Button
                onClick={() => {
                  void handleLoadDemo();
                }}
                startIcon={<RefreshIcon />}
                variant="contained"
                sx={{
                  textTransform: "none",
                  fontWeight: 500,
                  borderRadius: 1.5,
                  px: 2,
                  py: 0.5,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "white",
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.22)",
                  },
                }}
              >
                Load demo
              </Button>
            </Tooltip>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {/* Right-side actions */}
          <Box className="rightButtons" sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Tooltip title="Export file">
              <Button
                onClick={handleDownload}
                startIcon={<FileDownloadIcon />}
                sx={{ color: "white", textTransform: "none" }}
              >
                Export
              </Button>
            </Tooltip>
            <Tooltip title="Import file">
              <Button
                onClick={handleImportMenuOpen}
                startIcon={<FileUploadIcon />}
                sx={{ color: "white", textTransform: "none" }}
              >
                Import
              </Button>
            </Tooltip>

            <Menu
              anchorEl={importMenuAnchor}
              open={Boolean(importMenuAnchor)}
              onClose={handleImportMenuClose}
            >
              <MenuItem onClick={handleImportFile}>
                <ListItemIcon>
                  <ComputerIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="From disk" />
              </MenuItem>

              <MenuItem onClick={handleImportGitRepo}>
                <ListItemIcon>
                  <CustomGitIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="From Git repository" />
              </MenuItem>
            </Menu>

            <HelpOverlay />

            <Tooltip title="WEISS source repository">
              <IconButton
                sx={{ color: "white" }}
                href={APP_SRC_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubIcon />
              </IconButton>
            </Tooltip>
            {isAuthenticated ? (
              <>
                <IconButton onClick={handleUserMenuOpen}>
                  <Avatar
                    src={user?.avatar_url}
                    alt={user?.username}
                    sx={{ width: 32, height: 32 }}
                  >
                    {user?.username?.[0]?.toUpperCase() ?? "U"}
                  </Avatar>
                </IconButton>

                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={handleUserMenuClose}
                >
                  <MenuItem>
                    <ListItemIcon>
                      <AccountCircleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={user?.username} secondary={user?.role} />
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Logout" />
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button onClick={handleUserMenuOpen} sx={{ color: "white" }}>
                  Sign in
                </Button>
                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={handleUserMenuClose}
                >
                  {[
                    ...(isDemo
                      ? [
                          <MenuItem
                            key="demo-user"
                            onClick={() => void handleLogin(OAuthProviders.DEMO, Roles.USER)}
                          >
                            <ListItemIcon>
                              <PersonIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Demo User" />
                          </MenuItem>,
                          <MenuItem
                            key="demo-admin"
                            onClick={() => void handleLogin(OAuthProviders.DEMO, Roles.ADMIN)}
                          >
                            <ListItemIcon>
                              <AdminPanelSettingsIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Demo Admin" />
                          </MenuItem>,
                        ]
                      : []),
                    <MenuItem
                      key="microsoft"
                      onClick={() => void handleLogin(OAuthProviders.MICROSOFT)}
                    >
                      <ListItemIcon>
                        <MicrosoftIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Microsoft account" />
                    </MenuItem>,
                  ]}
                </Menu>
              </>
            )}
          </Box>
        </Toolbar>
      </StyledAppBar>
    </Box>
  );
}
