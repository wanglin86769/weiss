import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  InputAdornment,
  Stack,
} from "@mui/material";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import { useEditorContext } from "@src/context/useEditorContext";

function isValidGitUrl(url: string): boolean {
  if (!url) return false;

  const httpsPattern = /^https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+(\.git)?$/;

  return httpsPattern.test(url);
}

export interface GitImportData {
  alias: string;
  git_url: string;
}
interface ImportGitRepoDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: GitImportData) => void;
}

function suggestAliasFromGitUrl(url: string): string {
  try {
    const normalized = url.replace(/\/$/, "");
    const lastSegment = normalized.split("/").pop() ?? "";
    return lastSegment.replace(/\.git$/, "");
  } catch {
    return "";
  }
}

export default function ImportGitRepoDialog({
  open,
  onClose,
  onConfirm,
}: ImportGitRepoDialogProps) {
  const [alias, setAlias] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [aliasEdited, setAliasEdited] = useState(false);
  const { setReleaseShortcuts } = useEditorContext();
  const gitUrlValid = isValidGitUrl(gitUrl.trim());
  const showGitUrlError = gitUrl.length > 0 && !gitUrlValid;

  useEffect(() => {
    if (!aliasEdited && gitUrl.trim() && gitUrlValid) {
      const suggested = suggestAliasFromGitUrl(gitUrl.trim());
      if (suggested) {
        setAlias(suggested);
      }
    }
  }, [gitUrl, aliasEdited, gitUrlValid]);

  const handleConfirm = () => {
    if (!alias.trim() || !gitUrl.trim()) return;

    onConfirm({
      alias: alias.trim(),
      git_url: gitUrl.trim(),
    });

    resetAndClose();
  };

  const resetAndClose = () => {
    setAlias("");
    setGitUrl("");
    setAliasEdited(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onFocus={() => setReleaseShortcuts(true)}
      onBlur={() => setReleaseShortcuts(false)}
      onClose={resetAndClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Import from Git repository</DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide the HTTPS URL of the repository to be imported and a local alias to identify it.
          </Typography>

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Git repository URL"
              placeholder="https://github.com/organization/repository.git"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              error={showGitUrlError}
              helperText={showGitUrlError ? "Enter a valid HTTPS Git URL" : " "}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CustomGitIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              autoFocus
              fullWidth
              label="Repository alias"
              placeholder="weiss-example-opi"
              value={alias}
              onChange={(e) => {
                setAlias(e.target.value);
                setAliasEdited(true);
              }}
            />
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={resetAndClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!alias.trim() || !gitUrlValid}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
